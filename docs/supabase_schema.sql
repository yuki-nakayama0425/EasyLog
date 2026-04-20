-- posts table
create table posts (
  id uuid default gen_random_uuid() primary key,
  user_id text not null,
  text text,
  image_url text,
  location_lat float,
  location_lng float,
  emotion text,
  created_at timestamp with time zone default now()
);

-- articles table
create table articles (
  id uuid default gen_random_uuid() primary key,
  content text not null,
  date date not null,
  created_at timestamp with time zone default now()
);
