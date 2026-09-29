import { beforeEach, describe, expect, it } from "vitest";
import { Cl } from "@stacks/transactions";

const accounts = simnet.getAccounts();
const deployer = accounts.get("deployer")!;
const owner = accounts.get("wallet_1")!;
const heir = accounts.get("wallet_2")!;
const stranger = accounts.get("wallet_3")!;
const contract = `${deployer}.heirloom`;

const ERR_NO_VAULT = Cl.uint(100);
const ERR_VAULT_EXISTS = Cl.uint(101);
const ERR_NOT_HEIR = Cl.uint(102);
const ERR_STILL_ALIVE = Cl.uint(103);
const ERR_INVALID_AMOUNT = Cl.uint(104);
const ERR_INVALID_PERIOD = Cl.uint(105);
const ERR_INVALID_HEIR = Cl.uint(106);

const PERIOD = 10;
const AMOUNT = 5_000_000;

const stx = (who: string) => simnet.getAssetsMap().get("STX")?.get(who) ?? 0n;

const createVault = (sender = owner, amount = AMOUNT, period = PERIOD, to = heir) =>
  simnet.callPublicFn(
    "heirloom",
    "create-vault",
    [Cl.principal(to), Cl.uint(period), Cl.uint(amount)],
    sender,
  );

const claim = (sender = heir, from = owner) =>
  simnet.callPublicFn("heirloom", "claim", [Cl.principal(from)], sender);

describe("create-vault", () => {
  it("locks the STX in the contract and records the vault", () => {
    const before = stx(owner);
    const { result } = createVault();
    expect(result).toBeOk(Cl.uint(simnet.burnBlockHeight));
    expect(stx(owner)).toBe(before - BigInt(AMOUNT));
    expect(stx(contract)).toBe(BigInt(AMOUNT));

    const vault = simnet.callReadOnlyFn("heirloom", "get-vault", [Cl.principal(owner)], owner);
    const height = simnet.burnBlockHeight;
    expect(vault.result).toBeOk(
      Cl.tuple({
        heir: Cl.principal(heir),
        balance: Cl.uint(AMOUNT),
        period: Cl.uint(PERIOD),
        "last-check-in": Cl.uint(height),
        "unlock-height": Cl.uint(height + PERIOD),
        "current-height": Cl.uint(height),
        claimable: Cl.bool(false),
      }),
    );
  });

  it("rejects a second vault for the same owner", () => {
    createVault();
    expect(createVault().result).toBeErr(ERR_VAULT_EXISTS);
  });

  it("rejects naming yourself as heir", () => {
    expect(createVault(owner, AMOUNT, PERIOD, owner).result).toBeErr(ERR_INVALID_HEIR);
  });

  it("rejects a zero amount", () => {
    expect(createVault(owner, 0).result).toBeErr(ERR_INVALID_AMOUNT);
  });

  it("rejects a zero or oversized period", () => {
    expect(createVault(owner, AMOUNT, 0).result).toBeErr(ERR_INVALID_PERIOD);
    expect(createVault(owner, AMOUNT, 262_801).result).toBeErr(ERR_INVALID_PERIOD);
  });
});

describe("claim", () => {
  beforeEach(() => {
    createVault();
  });

  it("fails while the owner is still checking in", () => {
    simnet.mineEmptyBurnBlocks(PERIOD - 1);
    expect(claim().result).toBeErr(ERR_STILL_ALIVE);
  });

  it("pays the heir once the owner has been silent for the full period", () => {
    simnet.mineEmptyBurnBlocks(PERIOD);
    const before = stx(heir);
    expect(claim().result).toBeOk(Cl.uint(AMOUNT));
    expect(stx(heir)).toBe(before + BigInt(AMOUNT));
    expect(stx(contract)).toBe(0n);

    const vault = simnet.callReadOnlyFn("heirloom", "get-vault", [Cl.principal(owner)], owner);
    expect(vault.result).toBeErr(ERR_NO_VAULT);
  });

  it("cannot be claimed twice", () => {
    simnet.mineEmptyBurnBlocks(PERIOD);
    claim();
    expect(claim().result).toBeErr(ERR_NO_VAULT);
  });

  it("rejects anyone who is not the heir", () => {
    simnet.mineEmptyBurnBlocks(PERIOD);
    expect(claim(stranger).result).toBeErr(ERR_NOT_HEIR);
    expect(claim(owner).result).toBeErr(ERR_NOT_HEIR);
  });

  it("is blocked again when the owner checks in before the heir claims", () => {
    simnet.mineEmptyBurnBlocks(PERIOD);
    simnet.callPublicFn("heirloom", "check-in", [], owner);
    expect(claim().result).toBeErr(ERR_STILL_ALIVE);
  });

  it("only pays out the claimed vault, not other owners' funds", () => {
    createVault(stranger, 7_000_000);
    simnet.mineEmptyBurnBlocks(PERIOD);
    claim();
    expect(stx(contract)).toBe(7_000_000n);
  });
});

describe("owner actions reset the countdown", () => {
  beforeEach(() => {
    createVault();
    simnet.mineEmptyBurnBlocks(PERIOD - 1);
  });

  it("check-in", () => {
    expect(simnet.callPublicFn("heirloom", "check-in", [], owner).result).toBeOk(
      Cl.uint(simnet.burnBlockHeight),
    );
    simnet.mineEmptyBurnBlocks(PERIOD - 1);
    expect(claim().result).toBeErr(ERR_STILL_ALIVE);
  });

  it("deposit", () => {
    const { result } = simnet.callPublicFn("heirloom", "deposit", [Cl.uint(1_000_000)], owner);
    expect(result).toBeOk(Cl.uint(AMOUNT + 1_000_000));
    simnet.mineEmptyBurnBlocks(PERIOD - 1);
    expect(claim().result).toBeErr(ERR_STILL_ALIVE);
  });

  it("partial withdraw", () => {
    const { result } = simnet.callPublicFn("heirloom", "withdraw", [Cl.uint(1_000_000)], owner);
    expect(result).toBeOk(Cl.uint(AMOUNT - 1_000_000));
    simnet.mineEmptyBurnBlocks(PERIOD - 1);
    expect(claim().result).toBeErr(ERR_STILL_ALIVE);
  });
});

describe("withdraw", () => {
  beforeEach(() => {
    createVault();
  });

  it("returns everything and closes the vault", () => {
    const before = stx(owner);
    const { result } = simnet.callPublicFn("heirloom", "withdraw", [Cl.uint(AMOUNT)], owner);
    expect(result).toBeOk(Cl.uint(0));
    expect(stx(owner)).toBe(before + BigInt(AMOUNT));
    expect(stx(contract)).toBe(0n);
    expect(
      simnet.callReadOnlyFn("heirloom", "get-vault", [Cl.principal(owner)], owner).result,
    ).toBeErr(ERR_NO_VAULT);
  });

  it("rejects more than the balance", () => {
    const { result } = simnet.callPublicFn("heirloom", "withdraw", [Cl.uint(AMOUNT + 1)], owner);
    expect(result).toBeErr(ERR_INVALID_AMOUNT);
  });

  it("only touches the caller's own vault", () => {
    const { result } = simnet.callPublicFn("heirloom", "withdraw", [Cl.uint(1)], stranger);
    expect(result).toBeErr(ERR_NO_VAULT);
  });
});

describe("set-heir and set-period", () => {
  beforeEach(() => {
    createVault();
  });

  it("moves the claim right to the new heir", () => {
    simnet.callPublicFn("heirloom", "set-heir", [Cl.principal(stranger)], owner);
    simnet.mineEmptyBurnBlocks(PERIOD);
    expect(claim(heir).result).toBeErr(ERR_NOT_HEIR);
    expect(claim(stranger).result).toBeOk(Cl.uint(AMOUNT));
  });

  it("rejects the owner as their own heir", () => {
    const { result } = simnet.callPublicFn("heirloom", "set-heir", [Cl.principal(owner)], owner);
    expect(result).toBeErr(ERR_INVALID_HEIR);
  });

  it("uses the new period for the countdown", () => {
    simnet.callPublicFn("heirloom", "set-period", [Cl.uint(3)], owner);
    simnet.mineEmptyBurnBlocks(3);
    expect(claim().result).toBeOk(Cl.uint(AMOUNT));
  });

  it("rejects a zero period", () => {
    const { result } = simnet.callPublicFn("heirloom", "set-period", [Cl.uint(0)], owner);
    expect(result).toBeErr(ERR_INVALID_PERIOD);
  });
});

it("check-in without a vault fails", () => {
  expect(simnet.callPublicFn("heirloom", "check-in", [], stranger).result).toBeErr(ERR_NO_VAULT);
});
