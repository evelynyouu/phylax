// Sample receipt for the landing page, from the design export.
export const SUBS: [name: string, cadence: string, yearly: number, flag: string][] = [
  ['Netflix Standard', 'Monthly, $15.49', 185.88, 'Price went up'],
  ['Spotify Premium', 'Monthly, $11.99', 143.88, ''],
  ['ChatGPT Plus', 'Monthly, $20.00', 240.00, ''],
  ['iCloud+ 200 GB', 'Monthly, $2.99', 35.88, ''],
  ['Adobe Creative Cloud', 'Yearly', 263.88, 'Renews Dec 1'],
  ['Notion Plus', 'Monthly, $10.00', 120.00, ''],
  ['Dropbox Plus', 'Yearly', 119.88, 'Overlaps iCloud'],
  ['GitHub Copilot', 'Monthly, $10.00', 120.00, ''],
  ['Hulu', 'Monthly, $7.99', 95.88, 'Trial converted'],
  ['Disney+', 'Monthly, $13.99', 167.88, ''],
  ['YouTube Premium', 'Monthly, $13.99', 167.88, ''],
  ['Amazon Prime', 'Yearly', 139.00, ''],
  ['Duolingo Super', 'Yearly', 59.99, ''],
  ['NYT Digital', 'Monthly, $4.25', 51.00, ''],
  ['Audible Premium', 'Monthly, $14.95', 179.40, '3 unused credits'],
  ['Headspace', 'Yearly', 69.99, 'Renews Jan 9'],
  ['Peloton App', 'Monthly, $12.99', 155.88, ''],
  ['Figma Professional', 'Monthly, $15.00', 180.00, ''],
  ['Uber One', 'Monthly, $9.99', 119.88, ''],
  ['DashPass', 'Monthly, $9.99', 119.88, 'Overlaps Uber One'],
  ['Strava', 'Yearly', 79.99, ''],
  ['Canva Pro', 'Yearly', 119.99, ''],
  ['1Password', 'Yearly', 35.88, ''],
  ['Grammarly Premium', 'Yearly', 144.00, ''],
  ['Patreon', 'Monthly, $5.00', 60.00, ''],
  ['Crunchyroll', 'Monthly, $7.99', 95.88, 'Trial converted']
];

export const money = (v: number) => v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
