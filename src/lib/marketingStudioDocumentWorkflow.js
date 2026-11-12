import {marketingTemplates} from "./marketingCatalogPolicy.js";
/** Help operators choose the right output without disguising a flyer as a native Word proposal. */
const WORKFLOWS={
 brochure:["One-page promotional flyer","Build an illustrated, client-branded promotional overview with merchandise, service descriptions and a clear next step.",true],
 package:["Package promotion","Promote the package with approved item imagery, package benefits and a request for a detailed quote.",true],
 fundraiser:["Fundraising promotion","Explain the program, then enter verified individual product prices and illustrative gross proceeds.",true],
 store:["Store announcement","Show approved products and explain the ordering process; verify the actual storefront link before sharing.",true],
 catalog:["Merchandise collection overview","Use approved products and customer prices; for all sizes, variants and multi-page catalog pages choose the full document builder.",true],
 product:["Product feature flyer","Highlight one approved decorated item and its factual benefits; use the detailed product guide for specifications.",true],
 mockup:["Artwork and merchandise preview","Show approved product mockups, but perform final formal artwork sign-off in the full document builder.",true],
 artwork:["Artwork service overview","Explain available branded variations, placement services and revision options. Formal approvals belong in the full document builder.",true],
 brand:["Brand services overview","Feature logo and brand-guide services; export the formal color, placement and usage guide from the full document builder.",true],
 proposal:["Proposal overview","Create a customer-facing visual summary; use the full document builder for terms, itemized pricing and formal acceptance.",true],
 pricing:["Pricing promotion","Promote product collections with verified customer-facing pricing; use the full builder for quantity tables and formal terms.",true],
 quote:["Quote cover flyer","Create an illustrated introduction; use the full document builder to export the authoritative itemized quote.",false],
 outreach:["Outreach handout","Create a promotional leave-behind, or use the full document builder for editable letters and email content.",true],
 description:["Product announcement","Create a one-page product announcement. The full builder is better for exact product descriptions and listings.",true],
 color:["Color collection overview","Explain available approved colors and use actual verified garment images; use the full builder for a complete color chart.",true],
 sample:["Sample program overview","Promote sample requests, but use the full builder to record customer selections and tracking.",true],
 intake:["Client introduction","Share a concise capability overview; collect required intake details in the full document builder.",false],
 onboarding:["Ordering overview","Explain how to order with approved storefront details; use the full builder for comprehensive customer instructions.",true]
};
export function marketingStudioWorkflow(templateId){
 const template=marketingTemplates.find(item=>item.id===templateId);
 const workflow=WORKFLOWS[template?.kind]||["Promotional overview","Create an illustrated one-page introduction using approved facts.",true];
 return {template:template?.id||"",label:template?.label||"Custom marketing flyer",purpose:workflow[0],description:workflow[1],
  allowsPromotionalFlyer:workflow[2],recommendedDetailedOutput:"Native Word and PDF via the full document builder",
  featureSet:["Approved client logo and colors","Approved product images and captions","Editable headline and campaign copy","Editable artwork services","Concepts, layout and export preflight"]};
}
