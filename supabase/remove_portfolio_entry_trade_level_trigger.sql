-- Removes the approximate database-side SL/TP trigger.
-- Buy-time SL/TP should be saved by the app using the same calculateTradeLevels()
-- logic that powers the stock page Suggested Levels card, so portfolio values match exactly.

drop trigger if exists stockgpt_set_entry_trade_levels_before_write on public.portfolio_holdings;

drop function if exists public.stockgpt_set_entry_trade_levels();
drop function if exists public.stockgpt_entry_trade_level_confidence(numeric, numeric, numeric);
