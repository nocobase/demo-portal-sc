import { registerTranslationResources } from "@nocobase/portal-sdk/i18n";
import { usersExample as enUS } from "./en-US";
import { usersExample as zhCN } from "./zh-CN";
import { additionalTranslations } from "./generated";

registerTranslationResources("app", {
  "en-US": enUS,
  "zh-CN": zhCN,
  ...additionalTranslations,
});
