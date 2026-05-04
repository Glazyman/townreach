insert into public.states (id, name, abbreviation, fips) values
  ('ny', 'New York', 'NY', '36'),
  ('nj', 'New Jersey', 'NJ', '34'),
  ('ma', 'Massachusetts', 'MA', '25')
on conflict (id) do nothing;

insert into public.counties (id, state_id, name, fips) values
  ('westchester-ny', 'ny', 'Westchester County', '119'),
  ('essex-nj', 'nj', 'Essex County', '013'),
  ('middlesex-ma', 'ma', 'Middlesex County', '017')
on conflict (id) do nothing;

insert into public.municipalities (id, county_id, state_id, name, kind, place_fips) values
  ('scarsdale-village', 'westchester-ny', 'ny', 'Scarsdale Village', 'village', '65431'),
  ('bronxville-village', 'westchester-ny', 'ny', 'Bronxville Village', 'village', '08532'),
  ('montclair-township', 'essex-nj', 'nj', 'Montclair Township', 'township', '47500'),
  ('cambridge-city', 'middlesex-ma', 'ma', 'Cambridge', 'city', '11000')
on conflict (id) do nothing;

insert into public.departments (id, name, slug, description) values
  ('building', 'Building Department', 'building', 'Permits, inspections, code compliance, contractor requirements.'),
  ('planning', 'Planning & Zoning', 'planning', 'Zoning boards, planning reviews, land-use applications.'),
  ('public-works', 'Public Works', 'public-works', 'Roads, infrastructure, water, sanitation, facilities.'),
  ('clerk', 'Town Clerk', 'clerk', 'Records, licenses, public notices, document requests.'),
  ('procurement', 'Procurement', 'procurement', 'Vendor registration, bids, purchasing offices.'),
  ('health', 'Public Health', 'health', 'Health offices, environmental health, local health departments.'),
  ('education', 'Education / School Board', 'education', 'District administration and elected school boards.')
on conflict (id) do nothing;
