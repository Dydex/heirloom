import React from 'react'

const steps = [
  {
    title: 'Lock',
    body: "Lock STX in your vault and name your heir's address. Your keys stay yours.",
  },
  {
    title: 'Check in',
    body: 'Press "I\'m alive" now and then. Each check-in resets a countdown measured in Bitcoin blocks.',
  },
  {
    title: 'Inherit',
    body: 'If you go silent for the full period, only your heir can claim the vault. No lawyer, no custodian, no shared seed phrase.',
  },
]

function About() {
  return (
    <div className='w-full my-[50px]'>
      <p className='text-[12px] font-mono text-[#F7931A] text-center mb-4'>Bitcoin inheritance, enforced by a contract</p>
      <h1 className='text-[36px] md:text-[48px] font-medium leading-[1.1] font-instrument text-center'>
        Your Bitcoin shouldn&apos;t <br className='hidden sm:block' />die with you.
      </h1>
      <p className='text-[14px] text-[#908E8E] text-center max-w-[560px] mx-auto mt-5 leading-relaxed'>
        Millions of BTC are gone for good because their owners died without passing on access.
        Heirloom lets you name an heir without handing over your keys.
      </p>
      <ol className='grid md:grid-cols-3 gap-3 mt-10'>
        {steps.map((step, i) => (
          <li key={step.title} className='bg-[#1F1E1F] rounded-[20px] p-5'>
            <p className='text-[12px] font-mono text-[#F7931A]'>0{i + 1}</p>
            <p className='text-[18px] font-instrument font-medium mt-1'>{step.title}</p>
            <p className='text-[13px] text-[#908E8E] mt-2 leading-relaxed'>{step.body}</p>
          </li>
        ))}
      </ol>
    </div>
  );
}

export default About
