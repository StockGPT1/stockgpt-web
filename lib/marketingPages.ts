export type MarketingPageKind = "use-cases" | "guides" | "compare";

export type MarketingPage = {
  kind: MarketingPageKind;
  slug: string;
  title: string;
  h1: string;
  description: string;
  intro: string;
  helps: readonly (readonly [title: string, copy: string])[];
  education: {
    heading: string;
    paragraphs: readonly string[];
    mistakes: readonly string[];
  };
  workflow: readonly (readonly [title: string, copy: string])[];
  faqs: readonly (readonly [question: string, answer: string])[];
};

const useCases: MarketingPage[] = [
  {
    kind: "use-cases",
    slug: "ai-stock-analysis-tool",
    title: "AI Stock Analysis Tool for Structured Research",
    h1: "AI stock analysis tool for structured research",
    description: "Turn a stock idea into a structured research workflow covering rankings, company context, news, numbers and trade-plan scenarios.",
    intro: "StockGPT helps you move from a ticker or headline to a repeatable research process. It organises evidence and questions; it does not issue buy or sell signals.",
    helps: [
      ["Start with context", "See where a company sits in a ranked S&P 500 research list before opening its detail page."],
      ["Check the evidence", "Bring price context, company information, news and key numbers into one workflow."],
      ["Test the idea", "Use trade-plan analysis to define scenarios, risks and invalidation points before deciding."],
      ["Keep control", "Treat every output as a starting point for your own research and judgement."],
    ],
    education: {
      heading: "What useful AI stock analysis should actually do",
      paragraphs: [
        "Good analysis is more than a generated opinion. It should help you understand the business, current expectations, recent news, financial evidence and the risks that could make a thesis wrong.",
        "An AI layer is most useful when it makes that process consistent. The goal is not to predict the next price move; it is to reduce skipped steps and expose weak assumptions.",
      ],
      mistakes: ["Asking only whether a stock will rise", "Treating a score as a guaranteed outcome", "Ignoring valuation, news timing or portfolio concentration"],
    },
    workflow: [
      ["Rankings", "Start broad and identify research priorities across the S&P 500."],
      ["Stock research page", "Review the company, score context, chart, news and research summary."],
      ["Trade-plan analysis", "Compare upside, downside and thesis-breaking scenarios."],
      ["Portfolio Draft", "Check whether the idea creates unwanted concentration or allocation risk."],
    ],
    faqs: [
      ["Does StockGPT tell me which stock to buy?", "No. It structures educational research and highlights questions to investigate before you make your own decision."],
      ["What can I analyse?", "You can explore ranked S&P 500 companies, individual stock pages, linked news context and Portfolio Drafts."],
      ["Is an AI score a prediction?", "No. It is a research signal built from model inputs and can be wrong or become stale as conditions change."],
    ],
  },
  {
    kind: "use-cases",
    slug: "ai-portfolio-builder",
    title: "AI Portfolio Builder for Portfolio Drafts",
    h1: "AI portfolio builder for Portfolio Drafts",
    description: "Create an educational Portfolio Draft from preferences, then review allocation, diversification, sector exposure and risk trade-offs.",
    intro: "StockGPT creates Portfolio Drafts that make allocation trade-offs visible. A draft is a research starting point—not a perfect portfolio or personalised recommendation.",
    helps: [
      ["Translate preferences", "Turn an amount, time horizon and risk preference into an inspectable draft."],
      ["See allocation", "Review position sizes, sectors and the balance between growth, defence and cash."],
      ["Spot concentration", "Identify where one company or sector could dominate the result."],
      ["Iterate deliberately", "Use the draft to ask better questions before committing real money."],
    ],
    education: {
      heading: "A portfolio is a set of trade-offs, not a generated answer",
      paragraphs: [
        "Portfolio construction involves risk capacity, time horizon, diversification, liquidity and the relationship between holdings. A list of popular stocks is not a portfolio process.",
        "A useful builder should show why allocations exist and where the draft is vulnerable. That visibility lets you adjust assumptions rather than accepting an opaque output.",
      ],
      mistakes: ["Confusing diversification with owning many similar stocks", "Ignoring position size and sector overlap", "Treating model allocations as personal financial advice"],
    },
    workflow: [
      ["Set preferences", "Choose an illustrative amount, risk level and time horizon."],
      ["Generate a Portfolio Draft", "Review proposed holdings and sector allocation."],
      ["Research each holding", "Open stock pages and check the numbers, news and risks."],
      ["Monitor trade-offs", "Track allocation and changes without assuming the draft is final."],
    ],
    faqs: [
      ["Is a Portfolio Draft personalised financial advice?", "No. It is an educational scenario generated from selected inputs and should be reviewed independently."],
      ["Can I review sector exposure?", "Yes. The draft displays allocation and sector mix so concentration is easier to see."],
      ["Can I change the draft?", "Yes. Use it as an iterative starting point and reconsider the inputs or holdings before making decisions."],
    ],
  },
  {
    kind: "use-cases",
    slug: "ai-trading-research",
    title: "AI Trading Research Software, Not Trading Signals",
    h1: "AI trading research software, not trading signals",
    description: "Research trade ideas with company context, news, risk and scenario planning instead of relying on automated buy or sell signals.",
    intro: "StockGPT supports the work that should happen before a trade decision. It helps frame a thesis and its risks; it does not tell you what to buy or promise an outcome.",
    helps: [
      ["Frame the thesis", "Write down why an idea might work and what evidence supports it."],
      ["Define risk first", "Review downside, invalidation and event risk before focusing on upside."],
      ["Connect the news", "Check whether a price move is linked to material company or market information."],
      ["Avoid blind execution", "Use research outputs as prompts, not commands to copy."],
    ],
    education: {
      heading: "Research software and signal services solve different problems",
      paragraphs: [
        "A signal compresses a complex decision into an action. That can hide assumptions about time horizon, position size, liquidity and risk tolerance.",
        "Research software keeps those assumptions visible. It helps you examine the setup and decide whether the idea belongs in your own process.",
      ],
      mistakes: ["Following a label without reading the underlying evidence", "Setting an upside target without defining downside", "Reacting to price before checking the catalyst"],
    },
    workflow: [
      ["Ranked shortlist", "Find companies that warrant further research rather than automatic action."],
      ["Stock context", "Review the business, chart, score explanation and relevant news."],
      ["Trade-plan analysis", "Map possible entry, risk and scenario logic."],
      ["Portfolio fit", "Check how the idea changes concentration and exposure."],
    ],
    faqs: [
      ["Does StockGPT send trading signals?", "No. Rankings and trade-plan analysis are research tools, not instructions to buy or sell."],
      ["Can it guarantee a target price?", "No. Targets are scenarios and may never be reached."],
      ["Who makes the final decision?", "You do. StockGPT is educational decision support and cannot know your full circumstances."],
    ],
  },
  {
    kind: "use-cases",
    slug: "trade-plan-analysis",
    title: "AI Trade-Plan Analysis for Stock Research",
    h1: "AI trade-plan analysis for stock research",
    description: "Review entry references, downside boundaries, upside scenarios and thesis risks as part of an educational stock research process.",
    intro: "Trade-plan analysis turns a vague idea into explicit scenarios. It helps you decide what to watch and when a thesis needs review, without becoming a copy-trade instruction.",
    helps: [
      ["Define the setup", "Separate the reason for the idea from a short-term price move."],
      ["Map downside", "State where the evidence would weaken or the planned risk becomes unacceptable."],
      ["Compare reward", "Judge whether an upside scenario is proportionate to the downside."],
      ["Plan reviews", "Identify catalysts, dates and metrics that may change the thesis."],
    ],
    education: {
      heading: "A trade plan is useful because it makes assumptions testable",
      paragraphs: [
        "Without a plan, people often change their reasoning after the price moves. A written scenario provides a reference for reviewing what actually changed.",
        "Entry, invalidation and upside levels should be treated as planning zones, not precise forecasts. News, liquidity and gaps can make actual outcomes very different.",
      ],
      mistakes: ["Using a stop as a guarantee against loss", "Choosing targets only to create attractive risk/reward", "Keeping a plan unchanged after material news"],
    },
    workflow: [
      ["Research the company", "Understand the business and expectations before looking at levels."],
      ["Check news context", "Identify catalysts that could change the setup."],
      ["Review scenarios", "Compare planning references for entry, downside and upside."],
      ["Monitor the thesis", "Revisit the plan when evidence, price or portfolio exposure changes."],
    ],
    faqs: [
      ["Is a trade plan a recommendation to trade?", "No. It is an educational framework for analysing a possible scenario."],
      ["Are entry and target levels guaranteed?", "No. They are model-generated planning references and markets can move through them."],
      ["Why include invalidation?", "It clarifies what evidence would make the original idea less credible."],
    ],
  },
  {
    kind: "use-cases",
    slug: "stock-ranking-tool",
    title: "AI Stock Ranking Tool for S&P 500 Research",
    h1: "AI stock ranking tool for S&P 500 research",
    description: "Use a ranked S&P 500 research priority list to shortlist companies, compare context and decide what deserves deeper investigation.",
    intro: "StockGPT ranks companies to organise research attention. A higher rank means research priority within the model—not a guaranteed opportunity or buy signal.",
    helps: [
      ["Start broad", "Scan a structured S&P 500 universe instead of relying on random ideas."],
      ["Compare consistently", "Use the same score framework across sectors and companies."],
      ["Filter the list", "Narrow by company, sector and visible research context."],
      ["Open the evidence", "Move from a rank into company-specific numbers, news and risk."],
    ],
    education: {
      heading: "Rankings are a queue for research, not a substitute for it",
      paragraphs: [
        "A ranking model reduces a large universe into an ordered list. That is useful for prioritisation, but the order cannot capture every qualitative risk or future event.",
        "The right next step after seeing a rank is to inspect why the company appears there and whether the evidence fits your own time horizon and portfolio.",
      ],
      mistakes: ["Buying the top-ranked name without research", "Comparing scores without sector context", "Assuming yesterday's ranking must remain relevant"],
    },
    workflow: [
      ["Scan rankings", "Identify a manageable shortlist across the S&P 500."],
      ["Compare context", "Review sector, price movement and score explanation."],
      ["Open stock pages", "Check news, fundamentals and scenario risks."],
      ["Reassess regularly", "Treat changes as prompts to investigate, not automatic actions."],
    ],
    faqs: [
      ["Is rank number one the best stock to buy?", "No. It is the model's current highest research priority, not a recommendation."],
      ["What universe is covered?", "The ranking workflow focuses on S&P 500 companies."],
      ["How should I use rank changes?", "Use them to ask what inputs or market conditions changed, then inspect the company evidence."],
    ],
  },
  {
    kind: "use-cases",
    slug: "stock-research-assistant",
    title: "AI Stock Research Assistant",
    h1: "AI stock research assistant for clearer decisions",
    description: "Ask structured stock research questions, challenge assumptions and connect company, ranking, portfolio and news context.",
    intro: "StockGPT helps you ask better questions about an idea. The assistant is designed to explain and pressure-test research, not to replace judgement with a confident answer.",
    helps: [
      ["Clarify a thesis", "Turn a vague belief into specific claims that can be checked."],
      ["Challenge confidence", "Ask what could make the idea wrong or already priced in."],
      ["Connect context", "Relate a stock to rankings, portfolio holdings and relevant news."],
      ["Find next steps", "Identify numbers, filings or events worth checking independently."],
    ],
    education: {
      heading: "The quality of an AI answer depends on the question and context",
      paragraphs: [
        "Questions such as 'Should I buy?' hide the decision criteria. Better questions ask about evidence, competing explanations, downside and what information is missing.",
        "A research assistant should acknowledge uncertainty and direct attention to verifiable facts. Fluency is not proof, so outputs still need checking.",
      ],
      mistakes: ["Treating confident language as accuracy", "Asking for a verdict instead of evidence", "Failing to verify time-sensitive numbers or news"],
    },
    workflow: [
      ["Choose a company", "Start from a ranking, search or existing holding."],
      ["Read the stock page", "Gather enough context to ask focused questions."],
      ["Run a StockGPT Check", "Pressure-test the thesis, risks and missing evidence."],
      ["Review portfolio fit", "Consider position size and correlated exposure before deciding."],
    ],
    faqs: [
      ["Can the assistant predict prices?", "No. It can discuss scenarios and evidence, but cannot know future market prices."],
      ["What is a good question to ask?", "Ask what evidence supports the thesis, what could disprove it and which assumptions appear most fragile."],
      ["Should I verify answers?", "Yes. Check important claims against current primary sources and your own research."],
    ],
  },
  {
    kind: "use-cases",
    slug: "portfolio-monitoring-tool",
    title: "Portfolio Monitoring Tool with AI Research Context",
    h1: "Portfolio monitoring with AI research context",
    description: "Track holdings, allocation, portfolio changes and linked research context without turning monitoring into automated trading advice.",
    intro: "StockGPT brings holdings, allocation, gains and losses, research scores and relevant context into one review workspace. Monitoring helps you notice questions; it does not decide what to trade.",
    helps: [
      ["Track allocation", "See current position sizes and where exposure has drifted."],
      ["Review concentration", "Identify large holdings and repeated sector risk."],
      ["Connect changes", "Relate portfolio movement to companies, rankings and news."],
      ["Maintain a process", "Review the thesis rather than reacting to every daily move."],
    ],
    education: {
      heading: "Monitoring should improve decisions, not increase noise",
      paragraphs: [
        "A portfolio dashboard can encourage overreaction if every move feels urgent. Useful monitoring distinguishes between ordinary volatility and information that changes a thesis.",
        "Allocation and concentration often matter more than a single headline. Review them alongside company-specific evidence and your intended time horizon.",
      ],
      mistakes: ["Checking price without checking thesis change", "Ignoring cash and position-size drift", "Treating an alert as an instruction to transact"],
    },
    workflow: [
      ["Add or import holdings", "Create a consistent view of the portfolio."],
      ["Review health drivers", "Check allocation, concentration and notable changes."],
      ["Open affected stocks", "Investigate company news and score context."],
      ["Update deliberately", "Record changes only after reviewing evidence and risk."],
    ],
    faqs: [
      ["Does monitoring include real money execution?", "No. StockGPT is a research workspace, not a broker or copy-trading platform."],
      ["What should I review first?", "Start with allocation, concentration and material thesis changes rather than the largest daily price move."],
      ["Are portfolio alerts financial advice?", "No. They are informational prompts that require your own review."],
    ],
  },
  {
    kind: "use-cases",
    slug: "stock-news-analysis",
    title: "Stock News Analysis and Ticker Impact Research",
    h1: "Stock news analysis linked to ticker research",
    description: "Connect headlines to affected companies, assess materiality and review stock-specific context before reacting to market news.",
    intro: "StockGPT links news context to companies so you can ask whether a headline changes revenue, costs, risk or expectations. It is a research filter, not a price prediction.",
    helps: [
      ["Find affected tickers", "Move from a broad event to companies that may have genuine exposure."],
      ["Judge materiality", "Separate operational impact from attention-grabbing language."],
      ["Check the time horizon", "Distinguish a short-term reaction from a durable thesis change."],
      ["Research before reacting", "Open the stock page and compare the headline with business and valuation context."],
    ],
    education: {
      heading: "A headline matters only through its effect on the business or expectations",
      paragraphs: [
        "Price can move on surprise, positioning and sentiment even when long-term fundamentals barely change. The first task is to identify the mechanism linking news to a company.",
        "Then ask whether the impact is already reflected in expectations, whether it is temporary and what evidence would confirm the effect.",
      ],
      mistakes: ["Reading only the headline", "Assuming every mentioned ticker has equal exposure", "Confusing immediate price reaction with lasting value"],
    },
    workflow: [
      ["Read the event summary", "Understand what happened without relying on the headline alone."],
      ["Review ticker links", "See which companies may be affected and why."],
      ["Open company research", "Check exposure, numbers, valuation and current thesis."],
      ["Frame scenarios", "List what would make the impact stronger, weaker or irrelevant."],
    ],
    faqs: [
      ["Does linked news prove a stock will move?", "No. It provides context; market reaction depends on expectations and many other factors."],
      ["What makes news material?", "Material news can change expected revenue, costs, financing, regulation, strategy or risk."],
      ["Should I act on breaking news immediately?", "Pause to verify the source, mechanism and time horizon before making your own decision."],
    ],
  },
  {
    kind: "use-cases",
    slug: "sp500-stock-research",
    title: "S&P 500 Stock Research Platform",
    h1: "S&P 500 stock research platform",
    description: "Research the S&P 500 through ranked priorities, company pages, linked news, trade-plan analysis and Portfolio Draft context.",
    intro: "StockGPT organises S&P 500 research into a repeatable path from broad universe to company evidence. Coverage creates a starting universe, not a promise that every company is suitable.",
    helps: [
      ["Cover a defined universe", "Start with established large US companies rather than an unbounded ticker list."],
      ["Shortlist systematically", "Use rankings and filters to narrow what deserves attention."],
      ["Research individual names", "Review company, chart, news and financial context."],
      ["Connect to a portfolio", "Check whether a researched company improves or duplicates existing exposure."],
    ],
    education: {
      heading: "Broad coverage is useful only when the workflow stays selective",
      paragraphs: [
        "The S&P 500 still contains hundreds of companies across very different sectors. A consistent shortlist process prevents research from becoming a stream of disconnected tabs.",
        "Coverage also has limits: index membership does not remove valuation, business or concentration risk. Each company still needs its own analysis.",
      ],
      mistakes: ["Assuming index membership means low risk", "Comparing companies across sectors without context", "Researching only familiar mega-cap names"],
    },
    workflow: [
      ["Scan the universe", "Use rankings to identify research priorities."],
      ["Filter by sector", "Compare companies with more relevant peers."],
      ["Open detailed research", "Review the story against news, numbers and risks."],
      ["Build a Portfolio Draft", "Explore how selected names interact at portfolio level."],
    ],
    faqs: [
      ["Does StockGPT cover stocks outside the S&P 500?", "The core ranking workflow described here focuses on S&P 500 companies."],
      ["Is every S&P 500 company a safe investment?", "No. Index membership does not remove business, market or valuation risk."],
      ["How often should I revisit research?", "Revisit it when material news, results, valuation or the original thesis changes."],
    ],
  },
  {
    kind: "use-cases",
    slug: "investing-research-tool",
    title: "Investing Research Tool for New Investors",
    h1: "Investing research tool for new investors",
    description: "Learn a structured stock research workflow that separates business evidence, valuation, news, risk and portfolio fit from hype.",
    intro: "StockGPT gives new investors a repeatable place to start. It helps organise research and explain trade-offs without pretending that software can remove uncertainty.",
    helps: [
      ["Know where to begin", "Move from a broad ranked list into one company at a time."],
      ["Learn the vocabulary", "See business, valuation, risk and news context in plain language."],
      ["Avoid hype-led decisions", "Compare a compelling story with actual evidence and expectations."],
      ["Think at portfolio level", "Use Portfolio Drafts to understand diversification and concentration."],
    ],
    education: {
      heading: "A beginner-friendly tool should teach a process, not sell certainty",
      paragraphs: [
        "New investors often face too much information and too little structure. A checklist reduces the chance of skipping fundamentals or focusing only on recent price performance.",
        "No checklist eliminates loss. The aim is to make uncertainty visible, slow down impulsive decisions and show where further learning is needed.",
      ],
      mistakes: ["Following social confidence instead of evidence", "Confusing a good company with a good price", "Putting too much into one idea"],
    },
    workflow: [
      ["Start broad", "Browse rankings to choose a small research shortlist."],
      ["Learn the company", "Understand how it makes money and what can go wrong."],
      ["Check news and numbers", "Compare the narrative with current evidence."],
      ["Review portfolio fit", "Explore allocation trade-offs in a Portfolio Draft."],
    ],
    faqs: [
      ["Is StockGPT suitable for learning?", "It is designed to support an educational research workflow, but it does not replace independent learning or professional advice."],
      ["Will it prevent losses?", "No. Investing involves risk and research cannot guarantee an outcome."],
      ["What should a beginner research first?", "Start with the business model, financial strength, valuation, key risks and how the position would affect diversification."],
    ],
  },
];

const guides: MarketingPage[] = [
  {
    kind: "guides",
    slug: "how-to-research-a-stock",
    title: "How to Research a Stock Before Buying",
    h1: "How to research a stock before buying",
    description: "A practical stock research process covering the business model, financials, valuation, news, risk, scenarios and portfolio fit.",
    intro: "Research cannot make a stock certain, but it can make your assumptions explicit. Work from the business and evidence toward scenarios rather than starting with a desired answer.",
    helps: [
      ["Understand the business", "Explain how the company makes money, who pays it and what drives demand."],
      ["Read the financial direction", "Review growth, margins, cash generation, debt and the quality of reported earnings."],
      ["Compare price with expectations", "Ask what the current valuation already assumes about future performance."],
      ["Define what can go wrong", "List business, financial, market and portfolio risks before considering upside."],
    ],
    education: {
      heading: "A seven-part stock research sequence",
      paragraphs: [
        "Start with the business model, competitive position and management priorities. Then review financial strength, growth quality and valuation using several periods rather than one headline number.",
        "Finish with recent news, scenario planning and portfolio fit. A company can be attractive on its own but still duplicate risks you already hold.",
      ],
      mistakes: ["Starting with a target price", "Using one ratio without peer or history context", "Ignoring what would disprove the thesis"],
    },
    workflow: [
      ["Shortlist", "Use rankings to choose a company worthy of deeper work."],
      ["Company page", "Review the business summary, chart, score context and style."],
      ["News and numbers", "Compare current events with operating and valuation evidence."],
      ["Trade plan and portfolio", "Frame scenarios, then check allocation and concentration."],
    ],
    faqs: [
      ["How long should stock research take?", "Long enough to explain the business, evidence, valuation and risks in your own words; complex companies usually require more work."],
      ["Should I research price or business first?", "Start with the business and its economics, then consider what the market price implies."],
      ["What is the final step?", "Write the thesis, key risks, review triggers and why the position would fit—or not fit—your portfolio."],
    ],
  },
  {
    kind: "guides",
    slug: "stock-analysis-checklist",
    title: "Stock Analysis Checklist for Beginners",
    h1: "Stock analysis checklist for beginners",
    description: "A beginner stock analysis checklist for business quality, financial strength, growth, valuation, risks, news and portfolio fit.",
    intro: "A checklist keeps research consistent when a compelling story or recent price move creates pressure to act quickly. Use it to find missing work, not to award a guaranteed pass mark.",
    helps: [
      ["Business", "Can you explain the product, customer, competitive advantage and main revenue drivers?"],
      ["Financial strength", "Are margins, cash flow, debt and share issuance moving in a healthy direction?"],
      ["Valuation", "What growth and profitability does the current price appear to require?"],
      ["Risk and fit", "Which events could damage the thesis, and how would the holding affect concentration?"],
    ],
    education: {
      heading: "Use the checklist as a sequence, not a scoring shortcut",
      paragraphs: [
        "Begin with understanding. If the business model is unclear, detailed valuation work can create false precision. Once the business is understood, test the quality and durability of the financial evidence.",
        "A checklist should end with unresolved questions. Those questions are often more useful than a simple yes or no because they tell you what to monitor.",
      ],
      mistakes: ["Ticking boxes without writing evidence", "Using growth without checking cash flow quality", "Forgetting dilution, debt or cyclicality"],
    },
    workflow: [
      ["Choose from rankings", "Start with a manageable research candidate."],
      ["Complete company checks", "Work through business, financial, growth and valuation evidence."],
      ["Add context", "Review linked news and trade-plan scenarios."],
      ["Check portfolio fit", "Use a Portfolio Draft to expose overlap and position-size risk."],
    ],
    faqs: [
      ["Does completing the checklist mean I should buy?", "No. It only shows that you performed a structured review; the evidence may still support waiting or rejecting the idea."],
      ["Which item matters most?", "Understanding how the company creates value and what could impair that process comes before precise valuation."],
      ["How often should I repeat it?", "Repeat the relevant sections after material results, guidance, strategy or valuation changes."],
    ],
  },
  {
    kind: "guides",
    slug: "how-to-build-a-portfolio-draft",
    title: "How to Build a Portfolio Draft",
    h1: "How to build a Portfolio Draft",
    description: "Build an educational Portfolio Draft by defining risk, time horizon, allocation, diversification and a repeatable review process.",
    intro: "A Portfolio Draft lets you explore allocation before treating any mix as final. The useful output is the trade-offs you can inspect, not a claim that the portfolio is perfect.",
    helps: [
      ["Set constraints", "Define the illustrative amount, time horizon, liquidity needs and risk tolerance."],
      ["Choose allocation deliberately", "Decide how much each role, sector and position can contribute."],
      ["Test diversification", "Look for hidden overlap in business drivers, factors and geography."],
      ["Create review rules", "State when allocation or a holding thesis should be revisited."],
    ],
    education: {
      heading: "Portfolio construction begins with constraints",
      paragraphs: [
        "Risk tolerance is not just a label. Consider the size and duration of losses you could withstand, when funds may be needed and whether income or growth is the main objective.",
        "Diversification reduces dependence on one outcome but cannot eliminate market risk. Review correlations and business exposures, not just ticker count.",
      ],
      mistakes: ["Allocating equally without considering risk", "Owning multiple companies driven by the same theme", "Ignoring cash, rebalancing and review rules"],
    },
    workflow: [
      ["Choose draft inputs", "Select amount, time horizon and risk preference."],
      ["Inspect proposed allocation", "Review holdings, sectors and position sizes."],
      ["Research every component", "Open stock pages and challenge the role of each holding."],
      ["Monitor and revise", "Track drift and update the draft when assumptions change."],
    ],
    faqs: [
      ["Why call it a Portfolio Draft?", "Because the output is an educational starting point that still requires review and adjustment."],
      ["How many holdings are enough?", "There is no universal number; diversification depends on position size and the risks shared across holdings."],
      ["Should a draft stay unchanged?", "No. Review it as your circumstances, evidence or market prices change."],
    ],
  },
  {
    kind: "guides",
    slug: "what-is-a-trade-plan",
    title: "What Is a Stock Trade Plan?",
    h1: "What is a stock trade plan?",
    description: "Learn how entry references, invalidation, risk, scenarios and watchlist triggers form an educational stock trade plan.",
    intro: "A stock trade plan records the logic of a possible decision before emotions and price movement rewrite it. It is a framework for review, not a command to trade.",
    helps: [
      ["Entry reference", "Define the conditions or price area where the setup would begin to make sense."],
      ["Invalidation", "State which evidence or price behaviour would undermine the thesis."],
      ["Upside scenario", "Describe what must go right and how expectations could change."],
      ["Review triggers", "List results, news, dates or metrics that require a fresh assessment."],
    ],
    education: {
      heading: "The plan separates preparation from execution",
      paragraphs: [
        "Writing scenarios in advance reduces the temptation to justify a position after conditions change. It also makes risk visible before upside captures all the attention.",
        "A plan cannot guarantee an exit price. Gaps, liquidity and fast news can produce losses beyond a planned boundary, so position size still matters.",
      ],
      mistakes: ["Using precise levels without a business thesis", "Moving invalidation to avoid admitting the idea changed", "Ignoring position size and portfolio risk"],
    },
    workflow: [
      ["Research first", "Understand the company, news and valuation context."],
      ["Define the thesis", "Write the evidence and time horizon."],
      ["Map scenarios", "Review possible entry, downside, upside and invalidation."],
      ["Add to a watchlist", "Monitor the conditions instead of treating the plan as an instruction."],
    ],
    faqs: [
      ["Is a trade plan the same as a signal?", "No. A plan documents scenarios and risk; it does not tell you that a trade must be placed."],
      ["What is invalidation?", "It is evidence or a condition that makes the original thesis materially less credible."],
      ["Can a plan change?", "Yes, when new evidence changes the thesis—but it should not be moved simply to avoid reviewing a loss."],
    ],
  },
  {
    kind: "guides",
    slug: "how-to-check-stock-hype",
    title: "How to Check Stock Hype Before You Buy",
    h1: "How to check stock hype before you buy",
    description: "Separate an exciting stock story from business evidence, valuation, material news, risk and realistic portfolio exposure.",
    intro: "Hype often begins with a real trend and then skips the question of price, evidence or execution. A short research pause can reveal what the narrative requires to remain true.",
    helps: [
      ["Name the claim", "Write exactly what supporters expect the company to achieve."],
      ["Check the business", "Look for revenue, margins, cash flow and competitive evidence behind the story."],
      ["Inspect valuation", "Ask how much success the current price already assumes."],
      ["Limit exposure", "Consider how enthusiasm could lead to an oversized or duplicated position."],
    ],
    education: {
      heading: "A strong story can coexist with a fragile investment case",
      paragraphs: [
        "A company may operate in an important market and still disappoint investors if expectations were higher than the delivered results. The gap between business progress and priced expectations matters.",
        "Check primary reporting, dates and actual financial impact. Repeated social posts are not independent confirmation.",
      ],
      mistakes: ["Counting attention as evidence", "Ignoring valuation because the theme feels inevitable", "Assuming a rising price validates every claim"],
    },
    workflow: [
      ["Find the company", "Use rankings and search to establish current research context."],
      ["Open the stock page", "Compare the narrative with business and price data."],
      ["Review news", "Separate new material facts from repeated commentary."],
      ["Run a StockGPT Check", "Ask what would disprove the idea and where confidence is weakest."],
    ],
    faqs: [
      ["Does hype mean a stock is bad?", "No. It means attention may be running ahead of evidence, so expectations and valuation deserve extra scrutiny."],
      ["What is the fastest useful check?", "Identify the central claim, find the financial metric that would confirm it and check what valuation assumes."],
      ["Can social media be a research source?", "It can surface ideas, but important claims should be verified against reliable and preferably primary sources."],
    ],
  },
  {
    kind: "guides",
    slug: "ai-stock-research-prompts",
    title: "AI Stock Research Prompts to Pressure-Test an Idea",
    h1: "AI stock research prompts to pressure-test an idea",
    description: "Use evidence-seeking AI stock research prompts for business quality, valuation, risks, news, scenarios and portfolio fit.",
    intro: "The best research prompts ask for evidence, uncertainty and competing explanations. Avoid prompts that request a direct buy or sell verdict without defining the decision criteria.",
    helps: [
      ["Business prompt", "Explain the company's revenue drivers, customer dependence and strongest competitive risks."],
      ["Evidence prompt", "Which metrics would confirm or weaken the growth thesis over the next reporting periods?"],
      ["Valuation prompt", "What operating assumptions appear necessary to justify the current valuation?"],
      ["Risk prompt", "What is the strongest bear case, and which evidence would show it is becoming more likely?"],
    ],
    education: {
      heading: "Prompt for analysis, not authority",
      paragraphs: [
        "A useful prompt defines the company, time horizon and question. It also asks the model to distinguish facts, estimates and uncertainty instead of blending them into one confident narrative.",
        "Follow up by requesting source dates and missing information. Time-sensitive financial and news claims should be verified outside the model.",
      ],
      mistakes: ["Asking only 'Should I buy?'", "Failing to specify time horizon", "Accepting invented precision or unsourced current facts"],
    },
    workflow: [
      ["Start with stock context", "Open the company page before asking broad questions."],
      ["Ask evidence prompts", "Explore business quality, valuation, risks and news."],
      ["Ask the opposite case", "Request the strongest competing explanation."],
      ["Connect to portfolio", "Ask how the idea could change concentration and scenario risk."],
    ],
    faqs: [
      ["What should I ask instead of 'Should I buy?'", "Ask which evidence supports the thesis, what is already priced in and what would make the idea wrong."],
      ["Can prompts produce current facts?", "They may, but current figures and news should always be checked against dated reliable sources."],
      ["Why ask for the bear case?", "It counteracts confirmation bias and reveals assumptions that a bullish prompt may overlook."],
    ],
  },
  {
    kind: "guides",
    slug: "how-to-analyse-stock-news",
    title: "How to Analyse Stock News Before Reacting",
    h1: "How to analyse stock news before reacting",
    description: "Assess a stock headline by source, material impact, affected tickers, expectations and time horizon before making your own decision.",
    intro: "Breaking news creates urgency, but the first price reaction does not explain the lasting business effect. Slow the process down enough to identify what actually changed.",
    helps: [
      ["Verify the source", "Find the original filing, release, transcript or named reporting where possible."],
      ["Identify the mechanism", "State how the event could affect revenue, costs, financing, regulation or risk."],
      ["Map affected companies", "Separate direct exposure from weak thematic association."],
      ["Compare expectations", "Ask whether the event is new, surprising and financially meaningful."],
    ],
    education: {
      heading: "Headline, impact and market reaction are three different things",
      paragraphs: [
        "A dramatic headline may have little financial effect, while a technical filing may materially alter future cash flows. Analysis begins by tracing the event to the business.",
        "Then consider time horizon. A one-quarter disruption and a permanent competitive loss should not be treated as the same thesis change.",
      ],
      mistakes: ["Sharing before verifying", "Assuming correlation proves impact", "Ignoring whether expectations already included the news"],
    },
    workflow: [
      ["Read the full context", "Go beyond the headline and check the publication date."],
      ["Review linked tickers", "Understand why each company may be affected."],
      ["Open stock research", "Compare the event with financial and valuation context."],
      ["Update scenarios", "Change a trade plan only if the evidence changes its assumptions."],
    ],
    faqs: [
      ["Why can good news cause a price fall?", "The outcome may be weaker than expectations, already priced in or accompanied by less favourable details."],
      ["What source should I prefer?", "Use company filings and releases for direct facts, then reliable reporting for broader context."],
      ["How do I judge materiality?", "Estimate whether the event can meaningfully change earnings, cash flow, financing, strategy or risk."],
    ],
  },
  {
    kind: "guides",
    slug: "portfolio-risk-checklist",
    title: "Portfolio Risk Checklist",
    h1: "Portfolio risk checklist",
    description: "Review concentration, sector exposure, position size, volatility, liquidity and thesis drift across a stock portfolio.",
    intro: "Portfolio risk is not captured by the number of holdings alone. Use this checklist to find where several positions depend on the same outcome or where one position dominates.",
    helps: [
      ["Concentration", "Measure the largest positions and the loss they could contribute."],
      ["Sector and factor exposure", "Look for repeated dependence on rates, growth, commodities or consumer demand."],
      ["Position size", "Compare size with volatility, confidence and the ability to tolerate loss."],
      ["Thesis drift", "Check whether holdings remain owned for the reasons they were added."],
    ],
    education: {
      heading: "Risk lives in relationships between holdings",
      paragraphs: [
        "Ten tickers can still form one concentrated bet if they share the same customers, economic sensitivity or valuation factor. Review underlying drivers rather than relying on labels.",
        "Risk also changes over time as prices move. A successful position can become the portfolio's largest exposure without any new purchase.",
      ],
      mistakes: ["Counting tickers instead of exposures", "Ignoring cash and liquidity needs", "Letting gains create accidental concentration"],
    },
    workflow: [
      ["Open portfolio monitoring", "Review current values and allocation."],
      ["Identify health drivers", "Check largest position, sectors, cash and alerts."],
      ["Research weak points", "Open affected stock pages and current news."],
      ["Draft alternatives", "Use a Portfolio Draft to explore different allocations before acting."],
    ],
    faqs: [
      ["Does diversification eliminate loss?", "No. It can reduce dependence on specific outcomes but cannot remove market risk."],
      ["How often should I check concentration?", "Review it after major price moves, contributions, withdrawals or thesis changes."],
      ["Is volatility the same as risk?", "No. Volatility measures price movement; permanent business impairment, liquidity and concentration are also important risks."],
    ],
  },
  {
    kind: "guides",
    slug: "how-to-compare-stocks",
    title: "How to Compare Two Stocks",
    h1: "How to compare two stocks",
    description: "Compare two stocks across business model, sector, margins, growth, valuation, balance sheet, risks and current news.",
    intro: "A fair comparison uses the same questions while respecting different business models. The cheapest ratio or fastest growth rate rarely settles the decision by itself.",
    helps: [
      ["Normalize the business", "Compare revenue models, customer quality and cyclicality before comparing ratios."],
      ["Compare financial quality", "Review growth, margins, cash conversion, debt and dilution across several periods."],
      ["Compare valuation", "Relate price multiples to durability, growth and risk rather than ranking them in isolation."],
      ["Compare portfolio role", "Ask which exposure each company adds and whether that role already exists."],
    ],
    education: {
      heading: "Comparable numbers need comparable economics",
      paragraphs: [
        "Two companies in the same sector can have different capital needs, revenue visibility and risk. Adjust the comparison to the drivers that matter for each business.",
        "Use both absolute and trend comparisons. A higher margin may be less informative than whether margins are sustainably improving or deteriorating.",
      ],
      mistakes: ["Choosing the lower P/E automatically", "Ignoring balance-sheet differences", "Comparing one quarter without a longer trend"],
    },
    workflow: [
      ["Open both stock pages", "Review company, score and chart context using the same sequence."],
      ["Compare fundamentals", "Line up growth, margins, cash flow, valuation and debt."],
      ["Compare news and scenarios", "Assess different catalysts and thesis risks."],
      ["Compare portfolio fit", "Choose whether either exposure improves diversification."],
    ],
    faqs: [
      ["Should I compare companies only within one sector?", "Peer comparisons are usually cleaner, but cross-sector comparisons can still assess portfolio role and risk."],
      ["Which metric should decide?", "No single metric should decide; use the metrics most connected to each business model."],
      ["Can both stocks be unattractive?", "Yes. A comparison does not require selecting one if valuation or evidence is weak for both."],
    ],
  },
  {
    kind: "guides",
    slug: "best-stock-research-workflow",
    title: "Best Stock Research Workflow for Beginners",
    h1: "A better stock research workflow for beginners",
    description: "Use a beginner-friendly workflow to start broad, shortlist, research company evidence, review news, frame scenarios and check portfolio fit.",
    intro: "A good workflow reduces random browsing and makes each decision traceable. The sequence matters: start broad, narrow deliberately and finish with risk and portfolio context.",
    helps: [
      ["Start broad", "Use a defined universe and rankings instead of chasing whichever ticker appears next."],
      ["Shortlist", "Choose a small number of companies for deeper work."],
      ["Investigate", "Review business, financial, valuation and news evidence."],
      ["Decide slowly", "Frame scenarios and portfolio fit before reaching your own conclusion."],
    ],
    education: {
      heading: "A repeatable workflow beats a collection of disconnected tips",
      paragraphs: [
        "Research quality improves when every idea passes through the same core questions. That makes it easier to compare companies and identify where evidence is missing.",
        "The workflow should allow rejection and waiting. If every research session ends in a purchase, the process is probably serving activity rather than judgement.",
      ],
      mistakes: ["Starting with social media conviction", "Researching only evidence that supports the idea", "Skipping portfolio fit after analysing the company"],
    },
    workflow: [
      ["Rankings", "Scan broadly and form a research shortlist."],
      ["Stock page", "Understand the business, price context and model explanation."],
      ["News and trade-plan analysis", "Review catalysts, downside and scenario logic."],
      ["Portfolio Draft", "Check diversification, allocation and whether the idea belongs."],
    ],
    faqs: [
      ["What is the best first step?", "Choose a defined universe and narrow it to a small research shortlist."],
      ["When should I stop researching?", "When you can explain the thesis, evidence, valuation, risks, review triggers and portfolio role—or when a major gap makes the idea unsuitable."],
      ["Is waiting a valid result?", "Yes. Good research often concludes that evidence or valuation is not yet sufficient."],
    ],
  },
];

const comparisons: MarketingPage[] = [
  {
    kind: "compare",
    slug: "stockgpt-vs-chatgpt-for-stock-research",
    title: "StockGPT vs ChatGPT for Stock Research",
    h1: "StockGPT vs ChatGPT for stock research",
    description: "Compare a dedicated stock research workflow with a general AI assistant across rankings, stock pages, news, Portfolio Drafts and trade-plan analysis.",
    intro: "ChatGPT is a general-purpose assistant. StockGPT is organised around a stock research workflow. The right choice depends on whether you need open-ended conversation or finance-specific structure.",
    helps: [
      ["General questions", "A general assistant can explain concepts and help brainstorm questions across many domains."],
      ["Structured universe", "StockGPT begins with S&P 500 rankings and dedicated company research pages."],
      ["Portfolio context", "StockGPT connects Portfolio Drafts and monitoring to the research workflow."],
      ["Scenario tools", "Trade-plan analysis and linked news keep stock-specific risks visible."],
    ],
    education: {
      heading: "General intelligence and product structure are different advantages",
      paragraphs: [
        "A general chatbot is flexible, but the user must supply the workflow, data context and verification discipline. A dedicated product can make those steps easier to repeat.",
        "Neither tool should be treated as a financial adviser. Current facts, market data and model-generated claims still need verification.",
      ],
      mistakes: ["Assuming a fluent answer contains current verified data", "Comparing tools only by prose quality", "Asking either tool for guaranteed predictions"],
    },
    workflow: [
      ["StockGPT rankings", "Start from a structured S&P 500 research list."],
      ["Stock pages and news", "Keep company-specific context together."],
      ["Portfolio Drafts", "Explore allocation and concentration trade-offs."],
      ["Use general AI selectively", "Use broad explanation where helpful, then verify important claims."],
    ],
    faqs: [
      ["Is StockGPT built on the same workflow as ChatGPT?", "No. StockGPT is a dedicated stock research product with rankings, stock pages, Portfolio Drafts and scenario tools."],
      ["Can either tool give financial advice?", "StockGPT does not provide financial advice, and general AI output should not be treated as professional advice."],
      ["Which is better for open-ended topics?", "A general assistant is broader; StockGPT is narrower and structured around stock research tasks."],
    ],
  },
  {
    kind: "compare",
    slug: "stockgpt-vs-yahoo-finance",
    title: "StockGPT vs Yahoo Finance for Stock Research",
    h1: "StockGPT vs Yahoo Finance for stock research",
    description: "Compare raw market data and finance news with a structured AI stock research workflow for prioritisation, scenarios and portfolio context.",
    intro: "Yahoo Finance is widely used for market data, quotes, news and company information. StockGPT focuses on turning that kind of evidence into a repeatable research workflow.",
    helps: [
      ["Market reference", "Yahoo Finance is useful for browsing quotes, charts, financial statements and broad news."],
      ["Research prioritisation", "StockGPT ranks the S&P 500 to help decide what deserves deeper work."],
      ["Explanation layer", "StockGPT connects score context, relevant news and scenario questions."],
      ["Portfolio workflow", "Portfolio Drafts and monitoring make allocation trade-offs visible."],
    ],
    education: {
      heading: "Data access and research organisation are complementary",
      paragraphs: [
        "Raw data is essential, but it does not decide which questions matter. A workflow adds sequence: shortlist, understand, verify, frame risk and check portfolio fit.",
        "Dedicated data services can remain valuable verification sources. StockGPT should be used to organise research, not to discourage checking underlying information.",
      ],
      mistakes: ["Assuming more data automatically means better analysis", "Using one platform as the only source", "Comparing a quote service with a workflow as if they are identical"],
    },
    workflow: [
      ["Verify market facts", "Use reliable market-data sources for current quotes and filings."],
      ["Prioritise with StockGPT", "Use rankings to narrow the research list."],
      ["Connect context", "Review stock pages, news and trade-plan scenarios."],
      ["Check portfolio impact", "Use monitoring and Portfolio Drafts to assess exposure."],
    ],
    faqs: [
      ["Does StockGPT replace Yahoo Finance?", "Not necessarily. They serve different roles and can be used together in a research process."],
      ["Which is focused on rankings?", "StockGPT provides a dedicated ranked S&P 500 research priority workflow."],
      ["Should market data be verified?", "Yes. Important current figures should be checked against reliable dated sources."],
    ],
  },
  {
    kind: "compare",
    slug: "stockgpt-vs-broker-app-research",
    title: "StockGPT vs Broker App Research Tools",
    h1: "StockGPT vs broker app research tools",
    description: "Compare execution-focused broker apps with a pre-decision stock research workspace for rankings, scenarios, news and Portfolio Drafts.",
    intro: "Broker apps are primarily built for accounts, orders and execution. StockGPT is built for the research that should happen before a user reaches an execution decision.",
    helps: [
      ["Execution", "Broker apps manage accounts, order types, balances and regulated transaction workflows."],
      ["Pre-decision research", "StockGPT structures company, ranking, news and scenario analysis."],
      ["Draft before commitment", "Portfolio Drafts let you explore allocations without placing trades."],
      ["Separate research from action", "A dedicated workspace can reduce the pressure to transact while analysing."],
    ],
    education: {
      heading: "The interface goal shapes investor behaviour",
      paragraphs: [
        "An execution interface optimises access to a transaction. That is necessary for a broker, but it may not provide enough distance for slow research.",
        "A separate research workflow encourages users to define evidence, downside and portfolio fit before opening an order ticket.",
      ],
      mistakes: ["Treating a broker's popular list as research", "Confusing access to execution with decision support", "Skipping scenario analysis because the order screen is close"],
    },
    workflow: [
      ["Research in StockGPT", "Shortlist and examine the company away from an order ticket."],
      ["Review scenarios", "Check news, numbers, trade-plan logic and invalidation."],
      ["Draft portfolio impact", "Explore allocation and concentration before commitment."],
      ["Make your own execution decision", "Use a regulated broker only after completing your process."],
    ],
    faqs: [
      ["Can I trade through StockGPT?", "No. StockGPT is a research workspace, not a broker or trading platform."],
      ["Do broker apps provide research?", "Many do, but their scope varies; StockGPT focuses specifically on a structured pre-decision workflow."],
      ["Why separate research and execution?", "Separation can reduce impulsive action and make the evidence and risk review more deliberate."],
    ],
  },
  {
    kind: "compare",
    slug: "best-ai-stock-research-tools",
    title: "Best AI Stock Research Tools",
    h1: "Best AI stock research tools",
    description: "Learn how to evaluate AI stock research tools by evidence, workflow, transparency, risk language, portfolio context and verification.",
    intro: "There is no objective best tool for every investor. A useful comparison starts with the research job you need done and whether the product makes uncertainty and evidence visible.",
    helps: [
      ["Coverage and freshness", "Check which companies and data types are covered and how dates are shown."],
      ["Workflow depth", "Look for a path from shortlist to company, news, risk and portfolio context."],
      ["Explainability", "Prefer tools that expose factors and limitations instead of only a verdict."],
      ["Compliance-safe language", "Avoid products that promise outcomes or disguise signals as certainty."],
    ],
    education: {
      heading: "How to evaluate an AI stock research tool",
      paragraphs: [
        "Test whether the tool helps you verify evidence and ask better questions. A polished generated paragraph is less useful if it hides data dates, assumptions or uncertainty.",
        "Also consider whether the product supports your whole process. StockGPT is one research-first option built around rankings, stock pages, Portfolio Drafts, linked news and trade-plan analysis.",
      ],
      mistakes: ["Trusting unsupported 'best' rankings", "Choosing by prediction claims", "Ignoring data provenance, limitations and portfolio fit"],
    },
    workflow: [
      ["Define your research need", "Decide whether you need screening, explanation, news, portfolio analysis or all four."],
      ["Test with one known company", "Check accuracy, dates, uncertainty and depth."],
      ["Inspect the full workflow", "See whether conclusions connect back to evidence."],
      ["Use the demo", "Explore StockGPT's read-only product flow before creating an account."],
    ],
    faqs: [
      ["What makes an AI stock research tool useful?", "Clear evidence, current context, explainable outputs, risk framing and a workflow that supports independent decisions."],
      ["Is StockGPT objectively ranked number one?", "No such claim is made. StockGPT is presented as a research-first option with a specific structured workflow."],
      ["Should I use more than one source?", "Yes. Verify important facts and consider multiple reliable sources before making decisions."],
    ],
  },
  {
    kind: "compare",
    slug: "ai-stock-analysis-vs-stock-screeners",
    title: "AI Stock Analysis Tools vs Stock Screeners",
    h1: "AI stock analysis tools vs stock screeners",
    description: "Compare rule-based stock screeners with an AI research layer for explanation, prioritisation, news context, scenarios and portfolio fit.",
    intro: "Screeners filter a universe using explicit fields and thresholds. AI analysis can add explanation and context after the shortlist, but it should not hide the underlying evidence.",
    helps: [
      ["Screener strength", "Apply repeatable quantitative filters across a large universe."],
      ["AI analysis strength", "Explain relationships, summarise context and surface questions for deeper work."],
      ["Combined workflow", "Filter or rank first, then investigate the shortlisted companies."],
      ["Human decision", "Verify the data and decide whether the evidence fits your own process."],
    ],
    education: {
      heading: "Filtering and analysing are different stages",
      paragraphs: [
        "A screener answers which companies meet selected conditions. It does not automatically explain why those conditions matter or what qualitative risks sit outside the fields.",
        "An AI layer can contextualise the shortlist, connect news and frame scenarios. The best workflow preserves the transparency of filtering while adding structured interpretation.",
      ],
      mistakes: ["Using a screen result as a recommendation", "Applying thresholds without sector context", "Letting AI explanation obscure the original numbers"],
    },
    workflow: [
      ["Filter or rank", "Reduce the universe to a manageable research list."],
      ["Open stock pages", "Review the company and verify relevant metrics."],
      ["Add news and scenarios", "Investigate catalysts, downside and thesis change."],
      ["Check portfolio fit", "Decide whether the exposure adds diversification or duplication."],
    ],
    faqs: [
      ["Is an AI tool better than a screener?", "They solve different tasks. Screeners filter; AI tools can help explain and organise deeper research."],
      ["Can StockGPT replace all screening?", "StockGPT offers rankings and filters, but users may still use specialist data tools for custom screens and verification."],
      ["What should happen after a screen?", "Research the company, validate the data, assess valuation and risks, then review portfolio fit."],
    ],
  },
];

export const marketingPages: readonly MarketingPage[] = [
  ...useCases,
  ...guides,
  ...comparisons,
];

export function getMarketingPage(kind: MarketingPageKind, slug: string) {
  return marketingPages.find((page) => page.kind === kind && page.slug === slug);
}

export function getMarketingPagesByKind(kind: MarketingPageKind) {
  return marketingPages.filter((page) => page.kind === kind);
}
