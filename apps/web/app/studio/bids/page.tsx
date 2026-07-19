import { redirect } from 'next/navigation';

/**
 * Featured-bid auctions are mothballed (user decision 2026-07-18): auctions
 * need multiple bidders per region, which the market won't have for a while.
 * Brand visibility now runs on the same fixed-price, scarce-inventory
 * placement model as dispensaries — sold from the Promote page.
 */
export default function StudioBidsRedirect() {
  redirect('/studio/promote');
}
