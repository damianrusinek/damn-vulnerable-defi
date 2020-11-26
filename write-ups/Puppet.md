# Challenge #8: Puppet

This challenge is an example of vulnerable lending pool that lends a DVT token available on the well-known Uniswap exchange. In order to borrow DVT you must deposit twice as much ETH first. The goal of the challenge is to get as many DVT tokens from the pool as possible without loosing any ETH.

Here is the *borrow* function of the lending pool and the *require* statement that makes sure you deposit enough ETH:
```
// Allows borrowing `borrowAmount` of tokens by first depositing two times their value in ETH
function borrow(uint256 borrowAmount) public payable nonReentrant {
    uint256 amountToDeposit = msg.value;

    uint256 tokenPriceInWei = computeOraclePrice();
    uint256 depositRequired = borrowAmount.mul(tokenPriceInWei) * 2;
    
    require(amountToDeposit >= depositRequired, "Not depositing enough collateral");

    (...)
}
```

The pool uses the *computeOraclePrice* function to get the current token price and calculate the required deposit:
```
function computeOraclePrice() public view returns (uint256) {
    return uniswapOracle.balance.div(token.balanceOf(uniswapOracle));
}
```

Things to notice:
1. This is not a flash loan, whatever I borrow stays on my address (as long as I deposit enough ETH).
2. As the DVT is available on the Uniswap exchange I can get the token for ETH and the other way.
3. By manipulating the token price (in ETH) on the lending pool I could borrow many tokens for a little (or even a zero) ETH.
4. The lending pool calculates the token price using the token and ETH balances on the Uniswap exchange. Can you see how to abuse it?

## Exploit

In order to borrow tokens without loosing any ETH I have to decrease the deposit value, ideally make it zero and borrow tokens for free. Fortunately (for me, not the pool), the deposit value is calculated as the amount multiplied by twice the current price and the current price is calculated as the division of Uniswap's ETH and token balances.

The arithmetic operations (including division) are protected with SafeMath. It detects and reverts overflows and underflows but does not protected from all arithmetic bugs. One of them appears when the contract's creator forgets about the fact that division is actually an integer division. To recall, it means that hen you divide A by B while A is smaller than B, the result is zero!

With that in mind, the scenario of the attack is following:
1. At the beginning the token and ETH balance in Uniswap are both qual to 10 and the token price is 1 (=10/10).
2. I am buying one ETH for some of my tokens on the Uniswap exchange. 
3. Now the ETH balance of Uniswap is 9 and token balance is greater than 10. The token price (calculated by the *computeOraclePrice* function) is 0, because 9/10 is 0.
4. I borrow all DVT tokens from the pool without depositing any ETH. Profit!

## Lesson learned

The most important lesson here is the same as in one of the previous challenges - remember that the division in smart contracts is an integer division, even the SafeMath's one. 

The multiplication operation should proceed the division operation. Check this example:
* `9 / 10 * 100` is equal to `0`, because `9 / 10` is `0`,
* `9 * 100 / 10` is equal to `90`.

Also, make sure that when calculating conversion price (e.g. price in ETH for selling a token), the numerator and denominator are multiplied by the reserves. The numerator should be multiplied by the output reserve (the ETH balance in above example) and denominator should be multiplied by the input reserve (the token balance).

See the code below (based on the *getInputPrice* function from the Uniswap protocol):
```
function computeRequiredDeposit(uint256 borrowAmount, uint256 inputReserve, uint256 outputReserve) public view returns (uint256) {
    require(inputReserve > 0 && outputReserve > 0, "INVALID_VALUE");
    uint256 inputAmountWithFee = borrowAmount.mul(997);
    uint256 numerator = inputAmountWithFee.mul(outputReserve);
    uint256 denominator = inputReserve.mul(1000).add(inputAmountWithFee);
    return  (numerator / denominator).mul(2);
}
```

This function should be called in the *borrow* function as follows:
```
uint256 depositRequired = computeRequiredDeposit(borrowAmount,token.balanceOf(uniswapOracle),uniswapOracle.balance);
```

However, in this particular example (calculating the required deposit basing on the Uniswap market) the call to the *getTokenToEthInputPrice* function from the Uniswap exchange would be the easiest way to make it safe.

[<< Back to the README](../README.md)