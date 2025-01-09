import "dotenv/config";
import { clusterApiUrl, Connection, PublicKey } from "@solana/web3.js";
import fs from "fs";
import * as anchor from "@coral-xyz/anchor";
import { checkBalances } from "../src/utils/svm/svm-instruction";
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
  solayer: Token;
  un: Token;
  otc: string;
  network: string;
}

let connection: Connection;
let ctx: OTC;
let config: Config;

export const getMetrictSvm = async (configPath: string) => {
  const data = fs.readFileSync(configPath, "utf8");
  const configData: Config = JSON.parse(data);
  config = configData;
  const network = config.network;
  validateEnvAndNetwork("dev", network);

  if (network == "sol-devnet") {
    connection = new Connection(clusterApiUrl("devnet"));
    ctx = new OTC(connection, CHAIN_ID.SOLANA_DEVNET, Eenv.Dev);
  } else if (network == "sol-mainnet") {
    connection = new Connection(clusterApiUrl("mainnet-beta"));
    ctx = new OTC(connection, CHAIN_ID.SOLANA_MAINNET, Eenv.Prod);
  }

  const prom = [
    metricsSolBalance(),
    metricsTokenBalance(config.usdc),
    metricsTokenBalance(config.solayer),
    metricsTokenBalance(config.un),
    metricsConfigPda(),
    metricsVault(),
  ];
  const metrics = await Promise.all(prom);
  return metrics.join("\n");
};

export const metricsSolBalance = async () => {
  const prom = config.wallets.map((wallet) =>
    ctx.connection.getBalance(new PublicKey(wallet.address))
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

export const metricsTokenBalance = async (token) => {
  const prom = config.wallets.map((wallet) =>
    checkBalances(ctx, {
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

export const metricsConfigPda = async () => {
  const configPda = await getConfigAccountPda(ctx.program, ctx.authority);
  const configBalance = await ctx.connection.getBalance(configPda);

  return `wallet_balance{network="${
    config.network
  }", wallet="Config-Pda", address="${configPda.toString()}", token="SOL", tag="Config-Pda-SOL"} ${configBalance}\n`;
};

export const metricsVault = async () => {
  await ctx.bootstrap();
  const pda = await getVaultSolAccount(ctx.program, ctx.configPda);
  const vaultUsdcTokenAcc = getVaultTokenAccountPda(
    ctx.program,
    ctx.configPda,
    new PublicKey(config.usdc.address)
  );
  const vaultSolayerTokenAcc = getVaultTokenAccountPda(
    ctx.program,
    ctx.configPda,
    new PublicKey(config.solayer.address)
  );
  const vaultUnTokenAcc = getVaultTokenAccountPda(
    ctx.program,
    ctx.configPda,
    new PublicKey(config.un.address)
  );
  const balanceLamport = await ctx.connection.getBalance(pda);
  const balanceInSol = Number(balanceLamport) / Number(1e9);
  const balanceUsdc = await getTokenBalance(ctx.connection, vaultUsdcTokenAcc);
  const balanceSolayer = await getTokenBalance(
    ctx.connection,
    vaultSolayerTokenAcc
  );
  const balanceUn = await getTokenBalance(ctx.connection, vaultUnTokenAcc);

  return (
    `wallet_balance{network="${
      config.network
    }", wallet="Vault-Pda", address="${pda.toString()}", token="SOL" tag="Vault-Pda-SOL"} ${balanceInSol}\n` +
    `wallet_balance{network="${
      config.network
    }", wallet="Vault-Pda", address="${pda.toString()}", token="USDC" tag="Vault-Pda-USDC"} ${balanceUsdc.toString()}\n` +
    `wallet_balance{network="${
      config.network
    }", wallet="Vault-Pda", address="${pda.toString()}", token="Solayer" tag="Vault-Pda-Solayer"} ${balanceSolayer.toString()}\n` +
    `wallet_balance{network="${
      config.network
    }", wallet="Vault-Pda", address="${pda.toString()}", token="UN" tag="Vault-Pda-UN"} ${balanceUn.toString()}\n`
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
