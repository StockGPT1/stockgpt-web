-- Reject malformed numeric state at the authoritative table boundary.
-- NOT VALID preserves unknown legacy rows while enforcing every future insert/update.

alter table public.portfolio_holdings
  add constraint portfolio_holdings_finite_financial_values
  check (
    shares is not null
    and shares::text not in ('NaN', 'Infinity', '-Infinity')
    and shares > 0
    and entry_price is not null
    and entry_price::text not in ('NaN', 'Infinity', '-Infinity')
    and entry_price > 0
  ) not valid;

create function public.enforce_finite_portfolio_transaction_values()
returns trigger
language plpgsql
set search_path = ''
as $function$
begin
  -- Removal is the safe recovery path for a malformed tracked holding. Do not
  -- copy an uninterpretable quantity into its neutral audit row.
  if new.type = 'adjustment'
    and new.notes = 'Holding removed from tracking; no sale recorded.'
    and new.shares::text in ('NaN', 'Infinity', '-Infinity') then
    new.shares := null;
  end if;

  if (new.shares is not null and new.shares::text in ('NaN', 'Infinity', '-Infinity'))
    or (new.price is not null and new.price::text in ('NaN', 'Infinity', '-Infinity'))
    or (new.amount is not null and new.amount::text in ('NaN', 'Infinity', '-Infinity'))
    or (new.realised_pnl is not null and new.realised_pnl::text in ('NaN', 'Infinity', '-Infinity')) then
    raise exception using errcode = '22023', message = 'transaction_financial_state_invalid';
  end if;

  return new;
end;
$function$;

create trigger enforce_finite_portfolio_transaction_values
before insert or update on public.portfolio_transactions
for each row execute function public.enforce_finite_portfolio_transaction_values();

revoke execute on function public.enforce_finite_portfolio_transaction_values() from public, anon, authenticated;

comment on constraint portfolio_holdings_finite_financial_values on public.portfolio_holdings is
  'Stage 05 authoritative holding values must be finite and positive; unknown legacy rows remain unmodified.';

comment on function public.enforce_finite_portfolio_transaction_values() is
  'Rejects new non-finite ledger values while preserving neutral removal as a safe recovery path for malformed legacy holdings.';
