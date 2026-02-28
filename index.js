```javascript
const axios = require('axios');
const ethers = require('ethers');
const Web3 = require('web3');
const dotenv = require('dotenv');

dotenv.config();

const novaWalletAddress = process.env.NOVA_WALLET_ADDRESS;
const novaWalletPrivateKey = process.env.NOVA_WALLET_PRIVATE_KEY;
const basePlatformUrl = process.env.BASE_PLATFORM_URL;
const usdcContractAddress = process.env.USDC_CONTRACT_ADDRESS;
const virtualTokenContractAddress = process.env.VIRTUAL_TOKEN_CONTRACT_ADDRESS;

const web3 = new Web3(new Web3.providers.HttpProvider('https://mainnet.infura.io/v3/YOUR_INFURA_PROJECT_ID'));

const usdcContract = new web3.eth.Contract(require('./usdc-abi.json'), usdcContractAddress);
const virtualTokenContract = new web3.eth.Contract(require('./virtual-token-abi.json'), virtualTokenContractAddress);

async function setupNovaWalletConnection() {
  const wallet = new ethers.Wallet(novaWalletPrivateKey);
  return wallet;
}

async function configureSwapParameters() {
  const usdcAmount = ethers.utils.parseEther('100');
  const virtualTokenAmount = await getVirtualTokenAmount(usdcAmount);
  return { usdcAmount, virtualTokenAmount };
}

async function getVirtualTokenAmount(usdcAmount) {
  const response = await axios.get(`${basePlatformUrl}/prices`, {
    params: {
      base: 'USDC',
      quote: 'VIRTUAL',
    },
  });
  const price = response.data.price;
  const virtualTokenAmount = usdcAmount.mul(price);
  return virtualTokenAmount;
}

async function executeSwapTransaction(usdcAmount, virtualTokenAmount) {
  const wallet = await setupNovaWalletConnection();
  const usdcContractWithSigner = usdcContract.connect(wallet);
  const virtualTokenContractWithSigner = virtualTokenContract.connect(wallet);

  const txCount = await web3.eth.getTransactionCount(novaWalletAddress);
  const tx = {
    from: novaWalletAddress,
    to: usdcContractAddress,
    value: 0,
    gas: 2000000,
    gasPrice: web3.utils.toWei('20', 'gwei'),
    nonce: txCount,
    data: usdcContractWithSigner.methods.approve(virtualTokenContractAddress, usdcAmount).encodeABI(),
  };

  const signedTx = await wallet.signTransaction(tx);
  const txHash = await web3.eth.sendSignedTransaction(signedTx.rawTransaction);
  return txHash;
}

async function confirmTransactionHash(txHash) {
  const txReceipt = await web3.eth.getTransactionReceipt(txHash);
  if (txReceipt.status === '0x1') {
    console.log(`Transaction confirmed: ${txHash}`);
  } else {
    console.log(`Transaction failed: ${txHash}`);
  }
}

async function monitorTransactionStatus(txHash) {
  const txReceipt = await web3.eth.getTransactionReceipt(txHash);
  if (txReceipt.status === '0x1') {
    console.log(`Transaction confirmed: ${txHash}`);
  } else {
    console.log(`Transaction pending: ${txHash}`);
    setTimeout(() => monitorTransactionStatus(txHash), 10000);
  }
}

async function main() {
  const { usdcAmount, virtualTokenAmount } = await configureSwapParameters();
  const txHash = await executeSwapTransaction(usdcAmount, virtualTokenAmount);
  await confirmTransactionHash(txHash);
  await monitorTransactionStatus(txHash);
}

main();
```