import { getAssociatedTokenAddress } from "@solana/spl-token";
import { Connection, PublicKey } from "@solana/web3.js";

export const checkBalances = async (
  connection: Connection,
  data: {
    token: PublicKey;
    wallet: PublicKey;
  }
): Promise<{ balance: number }> => {
  try {
    const exTokenInfo = await connection.getParsedAccountInfo(data.token);
    const ata = await getAssociatedTokenAddress(
      data.token,
      data.wallet,
      false,
      exTokenInfo?.value?.owner
    );

    const balance = await connection.getTokenAccountBalance(ata, "confirmed");

    return { balance: balance.value.uiAmount || 0 };
  } catch (e) {
    return { balance: 0 };
  }
};
