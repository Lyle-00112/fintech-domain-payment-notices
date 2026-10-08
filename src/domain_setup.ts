import { z } from "zod";
import { request } from "./infrai.ts";

const config = z.object({
  domain: z.string().min(1),
  spf: z.string().startsWith("v=spf1"),
  dkimName: z.string().min(1),
  dkimValue: z.string().min(1),
  dmarc: z.string().startsWith("v=DMARC1"),
});

export async function onboardDomain(input: z.infer<typeof config>) {
  const values = config.parse(input);
  const zone = await request<{ zone_id: string }>("POST", "/v1/dns/domain/add", { domain: values.domain }, `zone:${values.domain}`);
  const records = [
    { name: values.domain, content: values.spf },
    { name: values.dkimName, content: values.dkimValue },
    { name: `_dmarc.${values.domain}`, content: values.dmarc },
  ];
  for (const record of records) {
    await request("PUT", "/v1/dns/record/upsert", {
      zone_id: zone.zone_id, record_type: "TXT", ...record,
    }, `dns:${zone.zone_id}:${record.name}:${record.content}`);
  }
  const result = await request<{ verification: { status: string } }>("POST", "/v1/email/domain/verify", { domain: values.domain }, `verify:${values.domain}`);
  return { zone_id: zone.zone_id, verification: result.verification.status };
}

if (process.argv[1]?.endsWith("domain_setup.ts")) {
  const [domain, spf, dkimName, dkimValue, dmarc] = process.argv.slice(2);
  onboardDomain({ domain, spf, dkimName, dkimValue, dmarc })
    .then((result) => console.log(JSON.stringify(result)))
    .catch((error) => { console.error(error); process.exitCode = 1; });
}
