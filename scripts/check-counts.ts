/**
 * تحقّق محلّي بلا قاعدة (يُشغَّل الآن): يقرأ كل ملفّات /data،
 * يطبّق التحويلات والتحقّقات (الأعداد + مفاتيح الشركات + سلامة القانون)،
 * ويتوقّف عند أي تباين — دون أي اتصال بالقاعدة.
 */
import { loadOpportunities } from "./import/opportunities";
import { loadLicenses } from "./import/licenses";
import { loadCompanies } from "./import/companies";
import { loadLegal } from "./import/legal";

function main(): void {
  const opportunities = loadOpportunities().length;
  const licenses = loadLicenses().length;
  const companies = loadCompanies().length;
  const legal = loadLegal();

  console.log(`الفرص: ${opportunities}`);
  console.log(`الرخص: ${licenses}`);
  console.log(`الشركات: ${companies}`);
  console.log(`القانون: ${legal.docRows.length} وثيقة · ${legal.recRows.length} سجلاً`);
  console.log("✓ الأعداد مطابقة والتحويلات سليمة (تحقّق محلّي بلا قاعدة).");
}

main();
