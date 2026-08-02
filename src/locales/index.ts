import { registerTranslationResources } from "@nocobase/portal-sdk/i18n";
import { starter as enUSStarter } from "./en-US";
import { starter as zhCNStarter } from "./zh-CN";
import { inv as enUSInv } from "./inv/en-US";
import { inv as zhCNInv } from "./inv/zh-CN";

registerTranslationResources("starter", {
  "en-US": enUSStarter,
  "zh-CN": zhCNStarter,
});

registerTranslationResources("inv", {
  "en-US": enUSInv,
  "zh-CN": zhCNInv,
});
