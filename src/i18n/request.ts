import { cookies } from "next/headers";
import { getRequestConfig } from "next-intl/server";
import de from "../messages/de.json";
import en from "../messages/en.json";

export default getRequestConfig(async () => {
  const locale = (await cookies()).get("AL_LOCALE")?.value === "en" ? "en" : "de";
  return { locale, messages: locale === "en" ? en : de };
});
