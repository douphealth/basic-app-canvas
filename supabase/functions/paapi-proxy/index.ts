import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const REGION_MAP: Record<string, { host: string; region: string; marketplace: string }> = {
  "us-east-1": { host: "webservices.amazon.com", region: "us-east-1", marketplace: "www.amazon.com" },
  "eu-west-1": { host: "webservices.amazon.co.uk", region: "eu-west-1", marketplace: "www.amazon.co.uk" },
  "eu-west-2": { host: "webservices.amazon.de", region: "eu-west-1", marketplace: "www.amazon.de" },
  "eu-west-3": { host: "webservices.amazon.fr", region: "eu-west-1", marketplace: "www.amazon.fr" },
  "ap-northeast-1": { host: "webservices.amazon.co.jp", region: "us-west-2", marketplace: "www.amazon.co.jp" },
  "ap-south-1": { host: "webservices.amazon.in", region: "eu-west-1", marketplace: "www.amazon.in" },
  "ap-southeast-1": { host: "webservices.amazon.sg", region: "us-west-2", marketplace: "www.amazon.sg" },
  "ap-southeast-2": { host: "webservices.amazon.com.au", region: "us-west-2", marketplace: "www.amazon.com.au" },
};

const RESOURCES = [
  "Images.Primary.Large",
  "Images.Primary.Medium",
  "ItemInfo.Title",
  "ItemInfo.ByLineInfo",
  "ItemInfo.Features",
  "ItemInfo.Classifications",
  "ItemInfo.ProductInfo",
  "Offers.Listings.Price",
  "Offers.Listings.DeliveryInfo.IsPrimeEligible",
  "Offers.Listings.SavingBasis",
];

const encoder = new TextEncoder();

async function hmacSha256(key: ArrayBuffer | Uint8Array, data: string): Promise<ArrayBuffer> {
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    key,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return crypto.subtle.sign("HMAC", cryptoKey, encoder.encode(data));
}

async function sha256Hex(data: string): Promise<string> {
  const hash = await crypto.subtle.digest("SHA-256", encoder.encode(data));
  return [...new Uint8Array(hash)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function toAmzDate(d = new Date()): { amzDate: string; dateStamp: string } {
  const iso = d.toISOString().replace(/[:-]|\.\d{3}/g, "");
  return { amzDate: iso, dateStamp: iso.substring(0, 8) };
}

async function signedPaapiCall(
  creds: { accessKey: string; secretKey: string; partnerTag: string; region: string },
  operation: "GetItems" | "SearchItems",
  payload: Record<string, unknown>,
) {
  const r = REGION_MAP[creds.region] || REGION_MAP["us-east-1"];
  const path = operation === "GetItems" ? "/paapi5/getitems" : "/paapi5/searchitems";
  const service = "ProductAdvertisingAPI";
  const target = `com.amazon.paapi5.v1.ProductAdvertisingAPIv1.${operation}`;
  const body = JSON.stringify(payload);
  const { amzDate, dateStamp } = toAmzDate();

  const headers: Record<string, string> = {
    "content-encoding": "amz-1.0",
    "content-type": "application/json; charset=UTF-8",
    host: r.host,
    "x-amz-date": amzDate,
    "x-amz-target": target,
  };

  const signedHeaderKeys = Object.keys(headers).sort();
  const canonicalHeaders = signedHeaderKeys.map((k) => `${k}:${headers[k]}\n`).join("");
  const signedHeadersStr = signedHeaderKeys.join(";");
  const payloadHash = await sha256Hex(body);

  const canonicalRequest = ["POST", path, "", canonicalHeaders, signedHeadersStr, payloadHash].join("\n");

  const credentialScope = `${dateStamp}/${r.region}/${service}/aws4_request`;
  const stringToSign = ["AWS4-HMAC-SHA256", amzDate, credentialScope, await sha256Hex(canonicalRequest)].join("\n");

  const kDate = await hmacSha256(encoder.encode(`AWS4${creds.secretKey}`), dateStamp);
  const kRegion = await hmacSha256(kDate, r.region);
  const kService = await hmacSha256(kRegion, service);
  const kSigning = await hmacSha256(kService, "aws4_request");

  const signatureKey = await crypto.subtle.importKey("raw", kSigning, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const signatureBuffer = await crypto.subtle.sign("HMAC", signatureKey, encoder.encode(stringToSign));
  const signature = [...new Uint8Array(signatureBuffer)].map((b) => b.toString(16).padStart(2, "0")).join("");

  const authorization = `AWS4-HMAC-SHA256 Credential=${creds.accessKey}/${credentialScope}, SignedHeaders=${signedHeadersStr}, Signature=${signature}`;

  const res = await fetch(`https://${r.host}${path}`, {
    method: "POST",
    headers: { ...headers, Authorization: authorization },
    body,
  });

  const text = await res.text();
  let json: any = null;
  try { json = text ? JSON.parse(text) : null; } catch { /* non-JSON */ }

  if (!res.ok) {
    const errMsg = json?.Errors?.[0]?.Message || json?.__type || text?.substring(0, 200) || `PA-API HTTP ${res.status}`;
    const code = json?.Errors?.[0]?.Code || "";
    throw new Error(`PA-API ${res.status}${code ? ` (${code})` : ""}: ${errMsg}`);
  }

  if (json?.Errors?.length && !json?.ItemsResult && !json?.SearchResult) {
    const e = json.Errors[0];
    throw new Error(`PA-API: ${e.Code || ""} ${e.Message || "Unknown error"}`);
  }

  return { json, marketplace: r.marketplace };
}

function mapItem(item: any) {
  if (!item?.ASIN) return null;
  return {
    asin: item.ASIN,
    title: item?.ItemInfo?.Title?.DisplayValue || "",
    price: item?.Offers?.Listings?.[0]?.Price?.DisplayAmount || "$XX.XX",
    imageUrl: item?.Images?.Primary?.Large?.URL || item?.Images?.Primary?.Medium?.URL || "",
    rating: 4.5,
    reviewCount: 0,
    prime: !!item?.Offers?.Listings?.[0]?.DeliveryInfo?.IsPrimeEligible,
    brand: item?.ItemInfo?.ByLineInfo?.Brand?.DisplayValue || item?.ItemInfo?.ByLineInfo?.Manufacturer?.DisplayValue || "",
    features: Array.isArray(item?.ItemInfo?.Features?.DisplayValues) ? item.ItemInfo.Features.DisplayValues.slice(0, 6) : [],
  };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "POST only" }), { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  const { accessKey, secretKey, partnerTag, region, operation, asin, keyword } = body;

  if (!accessKey || !secretKey || !partnerTag) {
    return new Response(JSON.stringify({ error: "Missing PA-API credentials" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  const creds = { accessKey, secretKey, partnerTag, region: region || "us-east-1" };
  const r = REGION_MAP[creds.region] || REGION_MAP["us-east-1"];

  try {
    if (operation === "GetItems") {
      if (!asin || !/^[A-Z0-9]{10}$/.test(String(asin).toUpperCase())) {
        return new Response(JSON.stringify({ error: "Invalid ASIN" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const { json } = await signedPaapiCall(creds, "GetItems", {
        ItemIds: [asin.toUpperCase()],
        ItemIdType: "ASIN",
        Resources: RESOURCES,
        PartnerTag: partnerTag,
        PartnerType: "Associates",
        Marketplace: r.marketplace,
      });
      const item = json?.ItemsResult?.Items?.[0];
      const mapped = mapItem(item);
      return new Response(JSON.stringify({ ok: true, product: mapped }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (operation === "SearchItems") {
      const kw = String(keyword || "").trim().slice(0, 200);
      if (!kw) {
        return new Response(JSON.stringify({ error: "Missing keyword" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const { json } = await signedPaapiCall(creds, "SearchItems", {
        Keywords: kw,
        SearchIndex: "All",
        ItemCount: 3,
        Resources: RESOURCES,
        PartnerTag: partnerTag,
        PartnerType: "Associates",
        Marketplace: r.marketplace,
      });
      const items: any[] = json?.SearchResult?.Items || [];
      const first = items.find((i: any) => i?.Images?.Primary?.Large?.URL || i?.Images?.Primary?.Medium?.URL) || items[0];
      const mapped = first ? mapItem(first) : null;
      return new Response(JSON.stringify({ ok: true, product: mapped }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({ error: "Invalid operation. Use GetItems or SearchItems." }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "PA-API call failed";
    return new Response(JSON.stringify({ error: message }), { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
