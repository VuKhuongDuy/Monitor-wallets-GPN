import { ethers, JsonRpcProvider } from "ethers";
import fs from "fs";
import ERC20_ABI from "../abis/ERC20.json";
import { validateEnvAndNetwork } from "../src/utils/utils";

interface Wallet {
  name: string;
  address: string;
}

interface Token {
  name: string;
  address: string;
  decimal: number;
}

interface Config {
  wallets: Wallet[];
  usdc: Token;
  symbiotic: Token;
  otc: string;
  network: string;
}

let provider: JsonRpcProvider;
let provider2: JsonRpcProvider;
let usdcContract;
let config: Config;

export const getMetrictEvm = async (configPath: string) => {
  const data = fs.readFileSync(configPath, "utf8");
  const configData: Config = JSON.parse(data);
  config = configData;
  const network = config.network;

  if (network == "eth-devnet" || network == "sepolia") {
    provider = new ethers.JsonRpcProvider(
      "https://sepolia.infura.io/v3/8c23b7669bf442359c7bb9e83f9f1375"
    );
    provider2 = new ethers.JsonRpcProvider(
      "https://eth-sepolia.g.alchemy.com/v2/LP3gpWDL31prhgIcEngF1XkT0In0hV1g"
    );
  } else if (network == "eth-mainnet") {
    provider = new ethers.JsonRpcProvider(
      "https://mainnet.infura.io/v3/d6f85183c07a493ba5b4863c1e7b7265"
    );
    provider2 = new ethers.JsonRpcProvider("https://eth.llamarpc.com");
  }

  let metricsUsdcBal;
  const metricsEthBal = await metricsEthBalance();

  let metrics = metricsEthBal + "\n\n";
  if (config.usdc) {
    usdcContract = new ethers.Contract(
      config.usdc.address,
      ERC20_ABI,
      provider
    );
    metricsUsdcBal = await metricsTokenBalance(usdcContract, config.usdc);
    metrics += metricsUsdcBal + "\n\n";
  }
  return metrics;
};

export const metricsEthBalance = async () => {
  // const prom = wallets.map(wallet => provider2.getBalance(wallet.address));
  // const balances = await Promise.all(prom);

  const balances = [];
  for (const wallet of config.wallets) {
    try {
      const data = await provider2.getBalance(wallet.address);
      balances.push(data);
    } catch (error) {
      console.error(`Error getting balance for wallet ${wallet.name}`, error);
    }
  }

  return balances
    .map((balance, index) => {
      const balanceInEther = ethers.formatEther(balance);
      return `wallet_balance{network="${config.network}", wallet="${config.wallets[index].name}", address="${config.wallets[index].address}", token="ETH", tag="${config.wallets[index].name}-ETH"} ${balanceInEther}`;
    })
    .join("\n");
};

export const metricsTokenBalance = async (contract, token) => {
  const prom = config.wallets.map((wallet) =>
    contract.balanceOf(wallet.address)
  );
  const balances = await Promise.all(prom);
  return balances
    .map((balance, index) => {
      let balanceInEther = ethers.formatEther(balance);
      if (token.decimal != 18) {
        balanceInEther = (
          balance / BigInt(Math.pow(10, token.decimal))
        ).toString();
      }
      return `wallet_balance{network="${config.network}", wallet="${config.wallets[index].name}", address="${config.wallets[index].address}", token="${token.name}", tag="${config.wallets[index].name}-${token.name}"} ${balanceInEther}`;
    })
    .join("\n");
};

export const metricsContract = async (contract, address) => {
  const [owner, ethBalance, usdcBalance, symbioticBalance] = await Promise.all([
    contract.owner(),
    provider.getBalance(address),
    usdcContract.balanceOf(address),
    symbioticContract.balanceOf(address),
  ]);

  const ethBalanceInEther = ethers.formatEther(ethBalance);
  const usdcBalanceInEther = ethers.formatEther(usdcBalance);
  const symbioticBalanceInEther = ethers.formatEther(symbioticBalance);

  // Expose contract balance as a Prometheus metric
  const metrics = [
    `contract_balance{contract="${address}", token="ETH"} ${ethBalanceInEther}`,
    `contract_balance{contract="${address}", token="USDC"} ${usdcBalanceInEther}`,
    `contract_balance{contract="${address}", token="Symbiotic"} ${symbioticBalanceInEther}`,
    `contract_owner{contract="${address}", owner="${owner}"} 1`,
  ].join("\n");

  return metrics;
};
