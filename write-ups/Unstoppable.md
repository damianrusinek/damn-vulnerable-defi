# Challenge #1: Unstoppable

This first challenge is to stop the pool from offering flash loans. Simply, the challenge is to DoS the contract. 

All further call to borrow the token should be blocked. In order to block it the pool must revert on any of the *requires* in the *flashLoan* function. 

Here is the code of the pool's contract:

```
function depositTokens(uint256 amount) external nonReentrant {
        require(amount > 0, "Must deposit at least one token");
        // Transfer token from sender. Sender must have first approved them.
        damnValuableToken.transferFrom(msg.sender, address(this), amount);
        poolBalance = poolBalance.add(amount);
}

function flashLoan(uint256 borrowAmount) external nonReentrant {
        require(borrowAmount > 0, "Must borrow at least one token");

        uint256 balanceBefore = damnValuableToken.balanceOf(address(this));
        require(balanceBefore >= borrowAmount, "Not enough tokens in pool");

        // Ensured by the protocol via the `depositTokens` function
        assert(poolBalance == balanceBefore);

        damnValuableToken.transfer(msg.sender, borrowAmount);

        IReceiver(msg.sender).receiveTokens(address(damnValuableToken), borrowAmount);

        uint256 balanceAfter = damnValuableToken.balanceOf(address(this));
        require(balanceAfter >= balanceBefore, "Flash loan hasn't been paid back");
}
```

There are two important things here to notice:
1. The pool keeps its balance in a local variable *poolBalance*.  
2. The mentioned variable is used in an assert in the *flashLoan* function: `assert(poolBalance == balanceBefore);`

BTW, why would the pool have additional variable to track its balance while it can check its token balance at any moment?

## Exploit

In order to block the pool, we must make the expression `poolBalance == balanceBefore` become *false*. The *balanceBefore* variable is the pool's token balance retrieved using ERC20 *balanceOf* function whenever someone borrows tokens. 

On the other hand, the *poolBalance* variable tracks the same token balance of the pool whenever someone deposits tokens to the pool using *depositToken* function. That is why the comment says the mentioned assertion is ensured by the *depositTokens* function.

If only there was any way to change the pool's token balance without calling the *depositTokens* function...

Oh wait! We can call the *transfer* function directly on the token's contract to bypass the increase of *poolBalance* variable (in *depositTokens* function).

The exploit is quite simple:
```
it('Exploit', async function () {
        /** YOUR EXPLOIT GOES HERE */
        let attackersBalance = await this.token.balanceOf(attacker);
        /* Change the pool's balance with a transfer */
        await this.token.transfer(this.pool.address, attackersBalance, { from: attacker });
});
```

## Lesson learned

Do not assume that the contract's token balance can be changed only with contracts's custom functions. Remember that it is possible to change the token balance of any address by calling the token's function directly.

It is also worth to remember that the balance can be changed using the *selfdestruct* function of other contract.

[<< Back to the README](../README.md)