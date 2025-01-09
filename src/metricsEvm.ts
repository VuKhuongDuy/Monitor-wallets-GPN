import { Contract, ethers, JsonRpcProvider } from "ethers";
import fs from "fs";
import ERC20_ABI from "../abis/ERC20.json";

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

export const metricsTokenBalance = async (contract: Contract, token: Token) => {
  const prom = config.wallets.map((wallet) =>
    contract.balanceOf(wallet.address)
  );
  const balances = await Promise.all(prom);
  const tokenDecimal = await contract.decimals()
  return balances
    .map((balance, index) => {
      let balanceInEther = ethers.formatEther(balance);
      if (Number(tokenDecimal) != 18) {
        balanceInEther = (
          balance / BigInt(Math.pow(10, Number(tokenDecimal)))
        ).toString();
      }
      return `wallet_balance{network="${config.network}", wallet="${config.wallets[index].name}", address="${config.wallets[index].address}", token="${token.name}", tag="${config.wallets[index].name}-${token.name}"} ${balanceInEther}`;
    })
    .join("\n");
};
