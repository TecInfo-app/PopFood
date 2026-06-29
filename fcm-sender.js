// FCM Sender for Client-Side (pedidos.html)
// Note: This exposes the service account key. Only use in secured admin environments!
const SERVICE_ACCOUNT = {
  "project_id": "topfood-9ff42",
  "private_key": "-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQC9rotbOIBSEFeO\nTNL1wOnHxuvm5CmJYlHz5bw+sZJH3OHgZLfbPcQ5QjiUVyeM8uJVOI6ZEHbGKtGL\nFhnwfw9CSI5utSk120QkOJO0RqR59U9l6RimJbRLT8VYOEnzV5JdkmcGC7LAOjeG\nz8go3oUfJkx51zCk9H8TlJ+XNOxdqBnTwHuz/D/UiQtkjseDvqQQrRL3yTO9HmmQ\nZxvYiujSj65NRXRKltWaUqJUfq+Fm6GzaxSbSsx/2PkVcCfgJYdZ0CJ6UE5cuDQd\nCvVvXvNEwW6t92A8FZH27iW4IBWsOTv7zB59pj+E/USBEF903NFLAPVtbNsfmLGo\n2m5CTxUnAgMBAAECggEACjp1TU/4q3QyJHxEC/iBIsK5SdQX4U6p+Kr0wbS1nKZu\nj7keqPXltOi7QFSKz3Dxf4LzPZHDtd/tOMDSWUOgwQREmfeu5zaRsBpU7K26hNET\nnP061QrHdCAzFhTC+BpKzDzuzUaoNvFsuRpPQtTs/McF7LQL7Xk5uQaUrISwEkS8\nZbV6ErYjoYAUGSewA/Okfju2go2tejXcfjBabB0Hl0HcirN0HjF3+cSfI/JmxpEi\np3qXpT8erVGOjJ6+wc7j6E5o0YUit8fu2xpFDW9xs/xVEZTB4ZHXxeO3mmGij0CZ\nIwtupeFIJdnwUuMOvFQUjb7eqhDZTuyHbBWBL6tTMQKBgQD2b4L0Sxe5hbX+T3+M\no+IrEDY4MAPOMvFjzU2AyF2G0wGJQUuPQcd//SQY6nXurruPs5eCDOGuns+Vw+n2\nRzrglzsEav2u/k9mCs99aA71g3eBHNfIsbH9lQf4hwMbRroq8ecKV1awd+xsy8Lp\nvI1b/GZb/nTJmZugNw1ENKsPJQKBgQDFCyY4JcxzNcgRxh3HJI7uN6Xi386qp6JS\nsFlz6YjSjEWTQik15vA1prNTCywNHr3KYosNR6eQl0bTcQOPAPb8lhT2qHZj5vuF\nRGxtLx43KwwiKfuOY7n5huFJlLMmFd/RLFWr4xeiPN6OoTWVDuN1wRl7qmeGdOeZ\n4CGuYxT3WwKBgQDRkfFGuRl67wffNlIdEz2CK65ASCzkTRRVMEGptDs9LfJPfBS6\nxlDXOjpZagJSsYvV3/+HXFcMPggAr/QmOVsLpfBNiIMmLyTsfWMIndai2WNmjFXB\nWcQpB3UY2BA/QP2PCdrWQ4H4XnPT7dBbH7sDL/kIYLOGwjfDny2MBFI4dQKBgBk0\nTuQ5uYg3JetYGzEA9SN1jMuTcz0TCklnc1nHUpAUD0ZB3UGe07UZKLEDqdPXzdEY\nf87oDoAJSa78MsdVCULP88iFTfeDcULfuLrSnxvRbtDj6+CP0xce8KxXz/6cJ6/6\n6s580uYWwSUfa9owOFo0pAzUhD+HrqRZLhW/aMwnAoGAdIThRy3Qz+1kf7NFE5J6\nFntmHkC/dO/I+hTemAZCfZ+ayrfS2L1pvEeWeOna8GNBBMkKCWlsxBIVLOuJWRZj\nPWlViqgUflTwQN42RtSZ82lScGcaQenH/DCvF9e0FVfUO/IqzJKi8ZIU1OKMUpdJ\nhavTsJSAHClE6VVDhABnMjM=\n-----END PRIVATE KEY-----\n",
  "client_email": "firebase-adminsdk-fbsvc@topfood-9ff42.iam.gserviceaccount.com"
};

let cachedAccessToken = null;
let tokenExpirationTime = 0;

async function getAccessToken() {
  if (cachedAccessToken && Date.now() < tokenExpirationTime) {
    return cachedAccessToken;
  }

  const header = {
    alg: "RS256",
    typ: "JWT"
  };

  const now = Math.floor(Date.now() / 1000);
  const claim = {
    iss: SERVICE_ACCOUNT.client_email,
    scope: "https://www.googleapis.com/auth/firebase.messaging",
    aud: "https://oauth2.googleapis.com/token",
    exp: now + 3600,
    iat: now
  };

  // Requires jsrsasign to be loaded in the global scope (window.KJUR)
  if (!window.KJUR) {
    throw new Error("jsrsasign library is not loaded.");
  }

  const sHeader = JSON.stringify(header);
  const sClaim = JSON.stringify(claim);
  
  const token = KJUR.jws.JWS.sign("RS256", sHeader, sClaim, SERVICE_ACCOUNT.private_key);

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: `grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=${token}`
  });

  const data = await response.json();
  if (data.access_token) {
    cachedAccessToken = data.access_token;
    tokenExpirationTime = Date.now() + (data.expires_in * 1000) - 60000; // Cache with 1 min buffer
    return cachedAccessToken;
  } else {
    console.error("Error getting OAuth token:", data);
    throw new Error("Failed to get OAuth token");
  }
}

export async function sendPushNotification(fcmToken, title, body, dataPayload = {}) {
  try {
    const accessToken = await getAccessToken();
    const projectId = SERVICE_ACCOUNT.project_id;
    
    const message = {
      message: {
        token: fcmToken,
        notification: {
          title: title,
          body: body,
          image: "novo-icone.png"
        },
        data: dataPayload,
        webpush: {
          fcm_options: {
            link: dataPayload.link || "https://tecinfo-app.github.io/PopFood/acompanhamento.html"
          }
        }
      }
    };

    const response = await fetch(`https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${accessToken}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(message)
    });

    const data = await response.json();
    console.log("FCM Send Response:", data);
    return data;
  } catch (e) {
    console.error("Error sending push notification:", e);
    return null;
  }
}
