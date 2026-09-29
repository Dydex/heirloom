;; heirloom.clar
;; A Bitcoin-timed inheritance switch.
;;
;; An owner locks STX in a vault and names an heir. Every action the owner
;; takes counts as a check-in. If the owner goes silent for `period` Bitcoin
;; blocks, the heir can claim the whole vault. Until the heir claims, the owner
;; can still check in and keep control.

(define-constant ERR_NO_VAULT (err u100))
(define-constant ERR_VAULT_EXISTS (err u101))
(define-constant ERR_NOT_HEIR (err u102))
(define-constant ERR_STILL_ALIVE (err u103))
(define-constant ERR_INVALID_AMOUNT (err u104))
(define-constant ERR_INVALID_PERIOD (err u105))
(define-constant ERR_INVALID_HEIR (err u106))

;; ~5 years of Bitcoin blocks at 10 minutes each.
(define-constant MAX_PERIOD u262800)

(define-map vaults
  principal
  {
    heir: principal,
    balance: uint,
    period: uint,
    last-check-in: uint,
  }
)

(define-private (valid-period (period uint))
  (and (> period u0) (<= period MAX_PERIOD))
)

;; Move STX from the contract's own balance to `recipient`.
(define-private (pay-out
    (amount uint)
    (recipient principal)
  )
  (as-contract? ((with-stx amount))
    (try! (stx-transfer? amount tx-sender recipient))
  )
)

;; Lock `amount` micro-STX and name an heir who can claim after `period`
;; Bitcoin blocks without a check-in.
(define-public (create-vault
    (heir principal)
    (period uint)
    (amount uint)
  )
  (begin
    (asserts! (is-none (map-get? vaults tx-sender)) ERR_VAULT_EXISTS)
    (asserts! (not (is-eq heir tx-sender)) ERR_INVALID_HEIR)
    (asserts! (valid-period period) ERR_INVALID_PERIOD)
    (asserts! (> amount u0) ERR_INVALID_AMOUNT)
    (try! (stx-transfer? amount tx-sender current-contract))
    (map-set vaults tx-sender {
      heir: heir,
      balance: amount,
      period: period,
      last-check-in: burn-block-height,
    })
    (print {
      event: "create-vault",
      owner: tx-sender,
      heir: heir,
      amount: amount,
      period: period,
    })
    (ok burn-block-height)
  )
)

;; "I'm alive" - resets the countdown.
(define-public (check-in)
  (let ((vault (unwrap! (map-get? vaults tx-sender) ERR_NO_VAULT)))
    (map-set vaults tx-sender (merge vault { last-check-in: burn-block-height }))
    (print {
      event: "check-in",
      owner: tx-sender,
    })
    (ok burn-block-height)
  )
)

;; Add more STX to an existing vault. Also counts as a check-in.
(define-public (deposit (amount uint))
  (let ((vault (unwrap! (map-get? vaults tx-sender) ERR_NO_VAULT)))
    (asserts! (> amount u0) ERR_INVALID_AMOUNT)
    (try! (stx-transfer? amount tx-sender current-contract))
    (map-set vaults tx-sender
      (merge vault {
        balance: (+ (get balance vault) amount),
        last-check-in: burn-block-height,
      })
    )
    (print {
      event: "deposit",
      owner: tx-sender,
      amount: amount,
    })
    (ok (+ (get balance vault) amount))
  )
)

;; Take STX back out. Withdrawing everything closes the vault.
(define-public (withdraw (amount uint))
  (let (
      (owner tx-sender)
      (vault (unwrap! (map-get? vaults owner) ERR_NO_VAULT))
      (balance (get balance vault))
    )
    (asserts! (and (> amount u0) (<= amount balance)) ERR_INVALID_AMOUNT)
    (try! (pay-out amount owner))
    (if (is-eq amount balance)
      (map-delete vaults owner)
      (map-set vaults owner
        (merge vault {
          balance: (- balance amount),
          last-check-in: burn-block-height,
        })
      )
    )
    (print {
      event: "withdraw",
      owner: owner,
      amount: amount,
    })
    (ok (- balance amount))
  )
)

;; Change who inherits. Also counts as a check-in.
(define-public (set-heir (heir principal))
  (let ((vault (unwrap! (map-get? vaults tx-sender) ERR_NO_VAULT)))
    (asserts! (not (is-eq heir tx-sender)) ERR_INVALID_HEIR)
    (map-set vaults tx-sender
      (merge vault {
        heir: heir,
        last-check-in: burn-block-height,
      })
    )
    (print {
      event: "set-heir",
      owner: tx-sender,
      heir: heir,
    })
    (ok true)
  )
)

;; Change how long the owner can stay silent. Also counts as a check-in.
(define-public (set-period (period uint))
  (let ((vault (unwrap! (map-get? vaults tx-sender) ERR_NO_VAULT)))
    (asserts! (valid-period period) ERR_INVALID_PERIOD)
    (map-set vaults tx-sender
      (merge vault {
        period: period,
        last-check-in: burn-block-height,
      })
    )
    (print {
      event: "set-period",
      owner: tx-sender,
      period: period,
    })
    (ok true)
  )
)

;; Called by the heir once the owner has been silent for `period` blocks.
(define-public (claim (owner principal))
  (let (
      (heir tx-sender)
      (vault (unwrap! (map-get? vaults owner) ERR_NO_VAULT))
      (balance (get balance vault))
    )
    (asserts! (is-eq heir (get heir vault)) ERR_NOT_HEIR)
    (asserts!
      (>= burn-block-height (+ (get last-check-in vault) (get period vault)))
      ERR_STILL_ALIVE
    )
    (map-delete vaults owner)
    (try! (pay-out balance heir))
    (print {
      event: "claim",
      owner: owner,
      heir: heir,
      amount: balance,
    })
    (ok balance)
  )
)

(define-read-only (get-vault (owner principal))
  (match (map-get? vaults owner)
    vault (let ((unlock-height (+ (get last-check-in vault) (get period vault))))
      (ok {
        heir: (get heir vault),
        balance: (get balance vault),
        period: (get period vault),
        last-check-in: (get last-check-in vault),
        unlock-height: unlock-height,
        current-height: burn-block-height,
        claimable: (>= burn-block-height unlock-height),
      })
    )
    ERR_NO_VAULT
  )
)
