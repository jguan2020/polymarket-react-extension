import { useEffect, useMemo, useState } from 'react';
import './App.css';

//Authentication Handler
import { useAuthApi } from './useAuthApi';

//Polymarket and AWS API endpoints
const searchApi = 'https://gamma-api.polymarket.com/public-search';
const awsApi = 'https://koge3v5c0f.execute-api.us-east-1.amazonaws.com/Prod';
const PAGE_SIZE = 9;


//Polymarket API response metadata
type Market = {
  id: string;
  question: string;
  description?: string;
  image?: string;
  icon?: string;
  outcomes?: string;
  outcomePrices?: string;
  liquidityNum: number;
  events?: { slug?: string }[];
  groupItemTitle?: string;
  groupItemThreshold?: string;
};

//Set Stake cents to be 2 decimal places
const formatStake = (value: number) =>
  value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

//Parses JSON responeses
const parseJsonArray = (value?: string) => {
  if (!value) return [];
  try {
    return JSON.parse(value) as string[];
  } catch {
    return [];
  }
};

function App() {

  //State variables
  const { token, userEmail, authLoading, authError, signIn, signUp, signOut } = useAuthApi();
  const [featured, setFeatured] = useState<Market[]>([]);
  const [page, setPage] = useState(0);
  const [textbox, setTextbox] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [follows, setFollows] = useState<string[]>([]);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  //Gets and caches active markets 
  const getActiveMarkets = useMemo(() => {
    const groups = new Map<string, Market>();
    featured.forEach((market) => {
      if (Number(market.liquidityNum) <= 0) return;
      const key =
        market.events?.[0]?.slug ||
        market.groupItemTitle ||
        market.groupItemThreshold ||
        market.id;
      const existing = groups.get(key);
      if (!existing || Number(market.liquidityNum) > Number(existing.liquidityNum)) {
        groups.set(key, market);
      }
    });
    return Array.from(groups.values());
  }, [featured]);

  //Current page markets
  const visible = useMemo(
    () => getActiveMarkets.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE),
    [getActiveMarkets, page],
  );

  //Polymarket search API based on query string
  const searchFunc = async (query: string) => {
    const searchUrl = new URL(searchApi);
    searchUrl.searchParams.set('q', query);
    searchUrl.searchParams.set('page', '1');
    searchUrl.searchParams.set('limit_per_type', '90');
    searchUrl.searchParams.set('type', 'events');
    searchUrl.searchParams.set('events_status', 'active');
    searchUrl.searchParams.set('sort', 'volume_24hr');
    searchUrl.searchParams.append('presets', 'EventsTitle');
    searchUrl.searchParams.append('presets', 'Events');

    const res = await fetch(searchUrl.toString());
    if (!res.ok) throw new Error(`Error: ${res.status}`);
    const data = await res.json();
    const events = Array.isArray(data.events) ? data.events : [];
    return events
      .flatMap((event: any) => event.markets ?? [])
      .filter((market: Market) => Number(market.liquidityNum) > 0)
      .slice(0, 90);
  };

  //Loads trending markets
  const loadFeatured = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(`${awsApi}/featured`);
      if (!res.ok) throw new Error(`Error: ${res.status}`);
      const data: Market[] = await res.json();
      const markets = data.filter((market) => Number(market.liquidityNum) > 0);
      setFeatured(markets);
      setPage(0);
    } catch (e: any) {
      setError(e.message ?? 'Failed to load markets');
    } finally {
      setLoading(false);
    }
  };

  //Helper function to hit search API
  const handleSearch = async () => {
    if (!textbox.trim()) return loadFeatured();
    try {
      setLoading(true);
      setError(null);
      const markets = await searchFunc(textbox.trim());
      setFeatured(markets);
      setPage(0);
    } catch (e: any) {
      setError(e.message ?? 'Search failed');
    } finally {
      setLoading(false);
    }
  };

  //Load followed markets
  const loadFollows = async () => {
    if (!token) return;
    const res = await fetch(`${awsApi}/follows`, {
      headers: { Authorization: token },
    });
    if (!res.ok) throw new Error('Failed to load follows');
    const data = await res.json();
    setFollows(data.map((item: any) => item.marketId));
  };

  //Add market to followed
  const handleFollow = async (marketId: string) => {
    if (!token) return;
    await fetch(`${awsApi}/follows`, {
      method: 'POST',
      headers: {
        Authorization: token,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ marketId }),
    });
    loadFollows().catch(console.error);
  };

  //Load trending markets on init
  useEffect(() => {
    loadFeatured();
  }, []);

  useEffect(() => {
    if (token) {
      loadFollows().catch(console.error);
    } else {
      setFollows([]);
    }
  }, [token]);

  return (
    <div className="root">
      <div className="dash">
        <div className="auth">
          {userEmail ? (
            <div className="auth-info">
              <span>Signed in as {userEmail}</span>
              <button onClick={signOut} disabled={authLoading}>
                Sign out
              </button>
            </div>
          ) : (
            <form
              className="auth-form"
              onSubmit={async (e) => {
                e.preventDefault();
                try {
                  await signIn(email, password);
                } catch {
                  /* auth error handled below */
                }
              }}
            >
              <input
                className="textbox"
                type="email"
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              <input
                className="textbox"
                type="password"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <div className="auth-buttons">
                <button type="submit" className="submit" disabled={authLoading}>
                  Sign in
                </button>
                <button
                  type="button"
                  className="submit secondary"
                  onClick={async () => {
                    try {
                      await signUp(email, password);
                    } catch {
                      /* handled in hook */
                    }
                  }}
                  disabled={authLoading}
                >
                  Sign up
                </button>
              </div>
              {authError && <div className="error">{authError}</div>}
            </form>
          )}
        </div>

        <div className="search">
          <div className="searchItems">
            <input
              className="textbox"
              type="text"
              placeholder="Search for a bet"
              value={textbox}
              onChange={(e) => setTextbox(e.target.value)}
            />
            <button className="submit" onClick={handleSearch} disabled={loading}>
              Search
            </button>
          </div>
          <div className="loading">{loading ? 'Loading...' : ''}</div>
        </div>
      </div>

      {error && <div className="error">{error}</div>}

      <div className="grid">
        {visible.map((item) => {
          const names = parseJsonArray(item.outcomes);
          const prices = parseJsonArray(item.outcomePrices).map((p) => Number(p) * 100);
          const isFollowed = follows.includes(item.id);
          return (
            <div className="cell" key={item.id}>
              <div className="row1">
                <img
                  className="item-img"
                  src={item.image || item.icon || '/images/placeholder.png'}
                  alt={item.question}
                />
                <div className="text">
                  <div className="yesFull">
                    <div className="yes">{names[0] ?? 'Yes'}</div>
                    <div className="yesNum">
                      {prices[0] ? `${prices[0].toFixed(2)}%` : '—'}
                    </div>
                  </div>
                  <div className="noFull">
                    <div className="no">{names[1] ?? 'No'}</div>
                    <div className="noNum">
                      {prices[1] ? `${prices[1].toFixed(2)}%` : '—'}
                    </div>
                  </div>
                </div>
              </div>
              <div className="row2">
                <div className="question">{item.question}</div>
              </div>
              <div className="cell-actions">
                <div className="pot">Total Stake: ${formatStake(item.liquidityNum)}</div>
                <button
                  className="submit follow"
                  onClick={() => handleFollow(item.id)}
                  disabled={!token || isFollowed}
                >
                  {isFollowed ? 'Following' : 'Follow'}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <div className="pages">
        {Array.from({ length: Math.ceil(getActiveMarkets.length / PAGE_SIZE) }).map(
          (_, i) => (
            <button
              key={i}
              className={i === page ? 'active' : ''}
              onClick={() => setPage(i)}
            >
              {i + 1}
            </button>
          ),
        )}
      </div>
    </div>
  );
}

export default App;
