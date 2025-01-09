import "dotenv/config";
import { clusterApiUrl, Connection, PublicKey } from "@solana/web3.js";
import fs from "fs";
import * as anchor from "@coral-xyz/anchor";
import { checkBalances } from "./utils";

interface Wallet {
  name: string;
  address: string;
}

interface Token {
  name: string;
  address: string;
}

interface Config {
  wallets: Wallet[];
  usdc: Token;
  solayer: Token;
  un: Token;
  otc: string;
  network: string;
}

let connection: Connection;
let config: Config;

export const getMetrictSvm = async (configPath: string) => {
  const data = fs.readFileSync(configPath, "utf8");
  const configData: Config = JSON.parse(data);
  config = configData;
  const network = config.network;

  if (network == "sol-devnet") {
    connection = new Connection(clusterApiUrl("devnet"));
  } else if (network == "sol-mainnet") {
    connection = new Connection(clusterApiUrl("mainnet-beta"));
  }

  const prom = [
    metricsSolBalance(),
    metricsTokenBalance(config.usdc),
  ];
  const metrics = await Promise.all(prom);
  return metrics.join("\n");
};

export const metricsSolBalance = async () => {
  const prom = config.wallets.map((wallet) =>
    connection.getBalance(new PublicKey(wallet.address))
  );
  const balances = await Promise.all(prom);
  return (
    balances
      .map((balance, index) => {
        const balanceInSol = Number(balance) / Number(1e9);
        return `wallet_balance{network="${config.network}", wallet="${
          config.wallets[index].name
        }", address="${config.wallets[index].address}", token="SOL" tag="${
          config.wallets[index].name
        }-SOL"} ${balanceInSol.toFixed(5)}`;
      })
      .join("\n") + "\n"
  );
};

export const metricsTokenBalance = async (token: Token) => {
  const prom = config.wallets.map((wallet) =>
    checkBalances(connection, {
      token: new PublicKey(token.address),
      wallet: new PublicKey(wallet.address),
    })
  );
  const balances = await Promise.all(prom);
  return (
    balances
      .map((balance, index) => {
        return `wallet_balance{network="${config.network}", wallet="${config.wallets[index].name}", address="${config.wallets[index].address}", token="${token.name}" tag="${config.wallets[index].name}-${token.name}"} ${balance.balance}`;
      })
      .join("\n") + "\n"
  );
};

export async function getTokenBalance(
  connection: anchor.web3.Connection,
  tokenAccount: anchor.web3.PublicKey
): Promise<anchor.BN> {
  try {
    const tokenBalance = await connection.getTokenAccountBalance(
      tokenAccount,
      "confirmed"
    );
    return new anchor.BN(tokenBalance.value.amount);
  } catch {
    return new anchor.BN(0);
  }
}
