const BASE_URL = 'https://monsterlab.io/api';

export interface MonsterLabCampaign {
  id: string;
  name: string;
  payoutRate?: number;
  status?: string;
  [key: string]: any;
}

export interface MonsterLabAccount {
  email?: string;
  username?: string;
  balance?: number;
  [key: string]: any;
}

export interface MonsterLabSubmissionResponse {
  success: boolean;
  clipId?: string;
  id?: string;
  status?: string;
  error?: string;
}

/**
 * Fetch list of active campaigns from MonsterLab.
 */
export async function getMonsterLabCampaigns(apiKey: string): Promise<MonsterLabCampaign[]> {
  const url = `${BASE_URL}/clips/campaigns`;
  
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Authorization': `ApiKey ${apiKey}`,
    },
  });

  const data = await response.json();

  if (!response.ok || data.success === false) {
    throw new Error(data.error || `HTTP error ${response.status} fetching campaigns`);
  }

  const campaignsList = data.data || data.campaigns || data;

  if (Array.isArray(campaignsList)) {
    return campaignsList.map((c: any) => ({
      id: c.campaignId || c.id || '',
      name: c.name || '',
      payoutRate: c.payoutRates?.instagram?.views ?? 0,
      status: c.type || 'active',
      ...c,
    }));
  }
  
  return [];
}

/**
 * Fetch account details (balance, subscription plan, profile info) from MonsterLab.
 */
export async function getMonsterLabAccount(apiKey: string): Promise<MonsterLabAccount> {
  const url = `${BASE_URL}/account`;

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Authorization': `ApiKey ${apiKey}`,
    },
  });

  const data = await response.json();

  if (!response.ok || data.success === false) {
    throw new Error(data.error || `HTTP error ${response.status} fetching account info`);
  }

  const acc = data.account || data.user || data.data || data;

  // Extract balance or set to 0 if not present
  return {
    email: acc.email,
    username: acc.displayName || acc.username,
    balance: acc.balance ?? 0.00,
    ...acc,
  };
}

/**
 * Submit a published clip's permalink to a campaign on MonsterLab.
 */
export async function submitClipToMonsterLab(
  apiKey: string,
  campaignId: string,
  url: string
): Promise<MonsterLabSubmissionResponse> {
  const submitUrl = `${BASE_URL}/clips/submit`;

  const response = await fetch(submitUrl, {
    method: 'POST',
    headers: {
      'Authorization': `ApiKey ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      campaignId,
      url,
    }),
  });

  const data = await response.json();

  if (!response.ok || data.success === false) {
    // If the server returns a detailed error object instead of a string
    const errorMsg = typeof data.error === 'object' && data.error !== null
      ? data.error.message || JSON.stringify(data.error)
      : data.error || `HTTP error ${response.status} submitting clip`;
    throw new Error(errorMsg);
  }

  return data;
}
