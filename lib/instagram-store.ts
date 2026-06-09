import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export type ConnectedInstagramAccount = {
  id: string;
  userId: string;
  username: string;
  accountType?: string;
  profilePictureUrl?: string;
  accessToken: string;
  tokenType?: string;
  expiresIn?: number;
  connectedAt: string;
};

export type PublicInstagramAccount = Omit<
  ConnectedInstagramAccount,
  "accessToken"
>;

const storeDir = path.join(process.cwd(), ".data");
const storePath = path.join(storeDir, "instagram-accounts.json");

async function readAccounts(): Promise<ConnectedInstagramAccount[]> {
  try {
    const raw = await readFile(storePath, "utf8");
    return JSON.parse(raw) as ConnectedInstagramAccount[];
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return [];
    }

    throw error;
  }
}

async function writeAccounts(accounts: ConnectedInstagramAccount[]) {
  await mkdir(storeDir, { recursive: true });
  await writeFile(storePath, JSON.stringify(accounts, null, 2));
}

export async function listInstagramAccounts(): Promise<PublicInstagramAccount[]> {
  const accounts = await readAccounts();

  return accounts.map((account) => ({
    id: account.id,
    userId: account.userId,
    username: account.username,
    accountType: account.accountType,
    profilePictureUrl: account.profilePictureUrl,
    tokenType: account.tokenType,
    expiresIn: account.expiresIn,
    connectedAt: account.connectedAt,
  }));
}

export async function getInstagramAccountsWithTokens(
  userId?: string,
): Promise<ConnectedInstagramAccount[]> {
  const accounts = await readAccounts();

  if (!userId || userId === "all") {
    return accounts;
  }

  return accounts.filter((account) => account.userId === userId);
}

export async function upsertInstagramAccount(account: ConnectedInstagramAccount) {
  const accounts = await readAccounts();
  const nextAccounts = [
    account,
    ...accounts.filter((item) => item.userId !== account.userId),
  ];

  await writeAccounts(nextAccounts);
}

export async function removeInstagramAccount(userId: string) {
  const accounts = await readAccounts();
  await writeAccounts(accounts.filter((account) => account.userId !== userId));
}
