import { useEffect, useState } from 'react';
import { QueryClient, QueryClientProvider, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Check,
  ChevronDown,
  ChevronRight,
  CircleAlert,
  Home as HomeIcon,
  ImagePlus,
  Link as LinkIcon,
  Loader2,
  LogOut,
  MapPin,
  MessageCircle,
  Menu,
  Plus,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Star,
  UserRound,
  X,
} from 'lucide-react';
import { Link, Route, Switch, useLocation, useParams } from 'wouter';
import { supabase } from './lib/supabase';

export type Listing = {
  id: string;
  title: string;
  category: string;
  price: number;
  description: string;
  condition: 'Nuevo' | 'Usado';
  location: string;
  seller: {
    id: string;
    name: string;
    rating: number;
    verified: boolean;
    phone: string | null;
  };
  image: string;
  gallery?: string[];
  createdAt: string;
  status: 'active' | 'sold' | 'pending' | 'hidden';
};

const queryClient = new QueryClient();
const categories = ['Todo', 'Motos', 'Celulares', 'Tecnología', 'Hogar', 'Deporte', 'Moda', 'Otros'];
const locations = [
  'Todo Puerto Boyacá',
  'Centro',
  'Pueblo Nuevo',
  'El Carmen',
  'Brisas del Magdalena',
  'San Antonio',
  'La Castellana',
  'El Progreso',
  'Villa Paz',
  'Simón Bolívar',
  '2 y Medio',
  'Puerto Romero',
];
const placeholderImage =
  'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 900 675"%3E%3Crect width="900" height="675" fill="%23123B5D"/%3E%3Ccircle cx="710" cy="150" r="210" fill="%2316A6A1" fill-opacity=".55"/%3E%3Cpath d="M0 520 220 330l140 110 170-200 370 310H0z" fill="%23FF9F43" fill-opacity=".85"/%3E%3C/svg%3E';

// --- SERVICIOS SUPABASE ---

async function fetchListings(params?: { category?: string; q?: string; location?: string; sort?: string }): Promise<Listing[]> {
  let query = supabase.from('listings').select('*').eq('status', 'active');

  if (params?.category && params.category !== 'Todo' && params.category !== 'Todas') {
    query = query.eq('category', params.category);
  }
  if (params?.location && params.location !== 'Toda Bogotá') {
    query = query.ilike('location', `%${params.location}%`);
  }
  if (params?.q) {
    query = query.or(`title.ilike.%${params.q}%,description.ilike.%${params.q}%`);
  }

  if (params?.sort === 'price-low') {
    query = query.order('price', { ascending: true });
  } else if (params?.sort === 'price-high') {
    query = query.order('price', { ascending: false });
  } else {
    query = query.order('created_at', { ascending: false });
  }

  const { data, error } = await query;
  if (error) throw error;

  return (data || []).map((row: any) => ({
    id: String(row.id),
    title: row.title,
    category: row.category || 'Otros',
    price: Number(row.price),
    description: row.description,
    condition: row.condition || 'Usado',
    location: row.location || 'Chapinero',
    image: row.image,
    gallery: row.gallery?.length ? row.gallery : [row.image],
    createdAt: row.created_at || new Date().toISOString(),
    status: row.status,
    seller: {
      id: row.seller_id || 'user-demo',
      name: row.seller_name || 'Vendedor del barrio',
      rating: Number(row.seller_rating || 5.0),
      verified: Boolean(row.seller_verified),
      phone: row.seller_phone || null,
    },
  }));
}

async function fetchListingById(id: string): Promise<Listing> {
  const { data: row, error } = await supabase.from('listings').select('*').eq('id', id).single();
  if (error || !row) throw new Error('Publicación no encontrada');

  return {
    id: String(row.id),
    title: row.title,
    category: row.category || 'Otros',
    price: Number(row.price),
    description: row.description,
    condition: row.condition || 'Usado',
    location: row.location || 'Chapinero',
    image: row.image,
    gallery: row.gallery?.length ? row.gallery : [row.image],
    createdAt: row.created_at || new Date().toISOString(),
    status: row.status,
    seller: {
      id: row.seller_id || 'user-demo',
      name: row.seller_name || 'Vendedor',
      rating: Number(row.seller_rating || 5.0),
      verified: Boolean(row.seller_verified),
      phone: row.seller_phone || null,
    },
  };
}

async function createListingInDb(form: any, user: any): Promise<Listing> {
  const rawPhone = form.phone.replace(/\D/g, '');
  const whatsappPhone = rawPhone.startsWith('57') ? rawPhone : `57${rawPhone}`;

  const rowData: any = {
    title: form.title,
    category: form.category,
    price: Number(form.price),
    description: form.description,
    condition: form.condition,
    location: form.location,
    image: form.image || placeholderImage,
    gallery: [form.image || placeholderImage],
    status: 'active',
    seller_name: user?.user_metadata?.name || user?.email?.split('@')[0] || 'Vecino',
    seller_rating: 5.0,
    seller_verified: true,
    seller_phone: whatsappPhone,
  };

  if (user?.id) {
    rowData.seller_id = user.id;
  }

  const { data, error } = await supabase.from('listings').insert([rowData]).select().single();
  if (error) throw error;

  return fetchListingById(data.id);
}

// --- UTILIDADES ---

function initials(name = 'Tu') {
  return name.split(' ').map((part) => part[0]).slice(0, 2).join('').toUpperCase();
}

function formatPrice(value: number) {
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(value);
}

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Hace poco';
  const days = Math.max(0, Math.floor((Date.now() - date.getTime()) / 86400000));
  if (days === 0) return 'Hoy';
  if (days === 1) return 'Ayer';
  if (days < 30) return `Hace ${days} días`;
  return date.toLocaleDateString('es-CO', { day: 'numeric', month: 'short' });
}

function LoadingBlocks({ count = 4 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
      {Array.from({ length: count }).map((_, index) => (
        <div className="overflow-hidden rounded-2xl border bg-card" key={index}>
          <div className="aspect-[4/3] bg-muted animate-pulse" />
          <div className="space-y-3 p-4">
            <div className="h-3 w-1/3 rounded bg-muted animate-pulse" />
            <div className="h-5 w-4/5 rounded bg-muted animate-pulse" />
            <div className="h-4 w-1/2 rounded bg-muted animate-pulse" />
          </div>
        </div>
      ))}
    </div>
  );
}

function StateMessage({ title, body, onRetry }: { title: string; body: string; onRetry?: () => void }) {
  return (
    <div className="rounded-2xl border border-dashed bg-card p-8 sm:p-14 text-center">
      <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-muted text-primary">
        <CircleAlert size={22} />
      </div>
      <h3 className="font-semibold text-primary">{title}</h3>
      <p className="mx-auto mt-2 max-w-sm text-sm text-muted-foreground">{body}</p>
      {onRetry && (
        <button
          className="mt-5 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition hover:-translate-y-0.5"
          onClick={onRetry}
        >
          Intentar de nuevo
        </button>
      )}
    </div>
  );
}

function Brand() {
  return (
    <Link href="/" className="group flex items-center gap-2.5">
      <span className="relative flex h-10 w-10 items-center justify-center overflow-hidden rounded-xl bg-accent text-primary">
        <span className="absolute -right-2 -top-2 h-6 w-6 rounded-full border-4 border-primary/20 bg-white/20" />
        <span className="font-mono text-lg font-bold">tu</span>
      </span>
      <span className="text-lg font-bold tracking-tight text-primary">
        Tu<span className="text-secondary">Marketplace</span>
      </span>
    </Link>
  );
}

function Avatar({ name, small = false }: { name?: string; small?: boolean }) {
  return (
    <span
      className={`flex ${
        small ? 'h-8 w-8 text-[11px]' : 'h-10 w-10 text-xs'
      } items-center justify-center rounded-full bg-secondary/15 font-bold text-secondary`}
    >
      {initials(name)}
    </span>
  );
}

// --- APP SHELL CON MENÚ MÓVIL TOTALMENTE FUNCIONAL ---

function AppShell({ children, currentUser, onLogout }: { children: React.ReactNode; currentUser: any; onLogout: () => void }) {
  const [location] = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const [userDropdown, setUserDropdown] = useState(false);

  const navItems = [
    { href: '/', label: 'Descubrir', icon: HomeIcon },
    { href: '/buscar', label: 'Buscar', icon: Search },
  ];

  return (
    <div className="min-h-[100dvh] bg-background flex flex-col justify-between">
      <header className="sticky top-0 z-50 border-b border-border/70 bg-background/95 backdrop-blur-xl">
        <div className="mx-auto flex h-[72px] max-w-[1440px] items-center justify-between px-4 sm:px-6 lg:px-10">
          <div className="flex items-center gap-8">
            <Brand />
            <nav className="hidden items-center gap-1 lg:flex">
              {navItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`rounded-lg px-3 py-2 text-sm font-semibold transition hover:bg-muted ${
                    location === item.href ? 'text-primary' : 'text-muted-foreground'
                  }`}
                >
                  <item.icon className="mr-1.5 inline-block h-4 w-4" />
                  {item.label}
                </Link>
              ))}
            </nav>
          </div>

          <div className="flex items-center gap-2.5">
            <Link
              href="/publicar"
              className="hidden items-center gap-2 rounded-xl bg-accent px-4 py-2.5 text-sm font-bold text-primary shadow-sm transition hover:-translate-y-0.5 hover:shadow-md sm:flex"
            >
              <Plus size={17} />
              Publicar gratis
            </Link>

            {currentUser ? (
              <div className="relative">
                <button
                  className="flex items-center gap-2 rounded-xl p-1.5 pr-2 transition hover:bg-muted"
                  onClick={() => setUserDropdown(!userDropdown)}
                >
                  <Avatar name={currentUser.user_metadata?.name || currentUser.email} small />
                  <ChevronDown size={14} className="text-muted-foreground" />
                </button>
                {userDropdown && (
                  <div className="absolute right-0 top-12 w-56 rounded-2xl border bg-card p-2 shadow-2xl z-50 animate-fade">
                    <div className="border-b px-3 pb-3 pt-2">
                      <p className="truncate text-sm font-bold text-primary">
                        {currentUser.user_metadata?.name || 'Mi Cuenta'}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">{currentUser.email}</p>
                    </div>
                    <button
                      className="mt-2 flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm text-destructive hover:bg-destructive/10"
                      onClick={() => {
                        setUserDropdown(false);
                        onLogout();
                      }}
                    >
                      <LogOut size={16} />
                      Cerrar sesión
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className="hidden items-center gap-2 sm:flex">
                <Link href="/login" className="rounded-xl px-3 py-2 text-sm font-semibold text-primary hover:bg-muted">
                  Ingresar
                </Link>
                <Link
                  href="/registro"
                  className="rounded-xl border border-primary/20 px-3 py-2 text-sm font-semibold text-primary hover:bg-muted"
                >
                  Crear cuenta
                </Link>
              </div>
            )}

            {/* BOTÓN HAMBURGUESA / CERRAR PARA PANTALLAS PEQUEÑAS */}
            <button
              aria-label="Abrir menú"
              className="rounded-xl p-2 text-primary hover:bg-muted lg:hidden"
              onClick={() => setMenuOpen(!menuOpen)}
            >
              {menuOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
          </div>
        </div>

        {/* MENÚ MÓVIL DESPLEGABLE */}
        {menuOpen && (
          <div className="border-t bg-card px-4 py-5 shadow-2xl lg:hidden animate-fade">
            <nav className="flex flex-col gap-2">
              {navItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMenuOpen(false)}
                  className={`flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-semibold ${
                    location === item.href ? 'bg-muted text-primary' : 'text-muted-foreground hover:bg-muted'
                  }`}
                >
                  <item.icon size={18} />
                  {item.label}
                </Link>
              ))}

              <Link
                href="/publicar"
                onClick={() => setMenuOpen(false)}
                className="mt-2 flex items-center justify-center gap-2 rounded-xl bg-accent px-4 py-3 text-sm font-bold text-primary"
              >
                <Plus size={18} />
                Publicar gratis
              </Link>

              {currentUser ? (
                <div className="mt-3 border-t pt-3">
                  <div className="px-3 py-2">
                    <p className="text-sm font-bold text-primary">
                      {currentUser.user_metadata?.name || 'Mi Perfil'}
                    </p>
                    <p className="text-xs text-muted-foreground">{currentUser.email}</p>
                  </div>
                  <button
                    onClick={() => {
                      setMenuOpen(false);
                      onLogout();
                    }}
                    className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-destructive hover:bg-destructive/10"
                  >
                    <LogOut size={17} />
                    Cerrar sesión
                  </button>
                </div>
              ) : (
                <div className="mt-3 flex flex-col gap-2 border-t pt-3">
                  <Link
                    href="/login"
                    onClick={() => setMenuOpen(false)}
                    className="flex items-center justify-center rounded-xl border px-4 py-2.5 text-sm font-semibold text-primary"
                  >
                    Ingresar
                  </Link>
                  <Link
                    href="/registro"
                    onClick={() => setMenuOpen(false)}
                    className="flex items-center justify-center rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground"
                  >
                    Crear cuenta
                  </Link>
                </div>
              )}
            </nav>
          </div>
        )}
      </header>

      <main className="mx-auto w-full max-w-[1440px] px-4 pb-16 sm:px-6 lg:px-10 flex-1">{children}</main>

      <footer className="border-t bg-card">
        <div className="mx-auto flex max-w-[1440px] flex-col gap-4 px-4 py-8 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-10">
          <Brand />
          <span>El barrio encuentra lo que necesita.</span>
          <span className="font-mono text-xs">TU / 2026</span>
        </div>
      </footer>
    </div>
  );
}

function SearchBar({ initialValue = '', onSubmit, large = false }: { initialValue?: string; onSubmit?: (value: string) => void; large?: boolean }) {
  const [value, setValue] = useState(initialValue);
  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    onSubmit?.(value);
  };
  return (
    <form
      onSubmit={submit}
      className={`flex w-full items-center gap-2 rounded-2xl border bg-card p-1.5 shadow-soft ${
        large ? 'min-h-[56px] sm:min-h-[62px]' : ''
      }`}
    >
      <Search className="ml-3 shrink-0 text-muted-foreground" size={19} />
      <input
        value={value}
        onChange={(event) => setValue(event.target.value)}
        placeholder="¿Qué estás buscando hoy?"
        className="min-w-0 flex-1 bg-transparent px-2 py-2 text-sm outline-none placeholder:text-muted-foreground"
      />
      <button
        type="submit"
        className="rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground transition hover:-translate-y-0.5"
      >
        Buscar
      </button>
    </form>
  );
}

function ListingCard({ listing }: { listing: Listing }) {
  return (
    <div className="group overflow-hidden rounded-2xl border bg-card transition duration-300 hover:-translate-y-1 hover:border-secondary/40 hover:shadow-xl">
      <div className="relative overflow-hidden bg-muted aspect-[4/3]">
        <Link href={`/producto/${listing.id}`} className="block h-full w-full">
          <img
            src={listing.image || placeholderImage}
            alt={listing.title}
            className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
          />
        </Link>
        <span className="absolute left-3 top-3 rounded-lg bg-card/90 px-2 py-1 text-[10px] font-bold uppercase tracking-widest text-primary backdrop-blur">
          {listing.condition}
        </span>
      </div>
      <Link href={`/producto/${listing.id}`} className="block p-4">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-widest text-secondary">{listing.category}</p>
            <h3 className="mt-1 line-clamp-2 font-bold leading-snug text-primary">{listing.title}</h3>
          </div>
          <span className="shrink-0 font-mono text-sm font-bold text-primary">{formatPrice(listing.price)}</span>
        </div>
        <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
          <span className="flex min-w-0 items-center gap-1 truncate">
            <MapPin size={13} className="shrink-0" />
            {listing.location}
          </span>
          <span>{formatDate(listing.createdAt)}</span>
        </div>
      </Link>
    </div>
  );
}

// --- HOME CON SELECTOR DE UBICACIÓN DESPLEGABLE INTERACTIVO ---

function Home() {
  const [, setLocation] = useLocation();
  const [category, setCategory] = useState('Todo');
  const [selectedLocation, setSelectedLocation] = useState('Todo Puerto Boyacá');
  const [locationDropdown, setLocationDropdown] = useState(false);

  const { data: listings = [], isLoading, isError, refetch } = useQuery({
    queryKey: ['listings', category, selectedLocation],
    queryFn: () =>
      fetchListings({
        category: category === 'Todo' ? undefined : category,
        location: selectedLocation === 'Todo Puerto Boyacá' ? undefined : selectedLocation,
      }),
  });

  const featured = listings.slice(0, 8);
  const handleSearch = (value: string) =>
    setLocation(value.trim() ? `/buscar?q=${encodeURIComponent(value.trim())}` : '/buscar');

  return (
    <div className="animate-fade">
      {/* SECCIÓN HERO SIN RECORTE DE MENÚ */}
      <section className="relative -mx-4 bg-primary px-4 pb-14 pt-12 text-primary-foreground sm:-mx-6 sm:px-6 lg:-mx-10 lg:px-10 lg:pb-20 lg:pt-20">
        
        {/* Círculos decorativos encapsulados con overflow-hidden */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute -right-24 -top-28 h-80 w-80 rounded-full border-[36px] border-secondary/20" />
          <div className="absolute bottom-[-5rem] left-[35%] h-52 w-52 rounded-full border-[28px] border-accent/15" />
        </div>

        <div className="relative mx-auto max-w-6xl">
          <div className="max-w-2xl animate-rise">
            <p className="mb-3 sm:mb-4 flex items-center gap-2 text-xs sm:text-sm font-bold tracking-wide text-accent">
              <Sparkles size={16} />
              LO QUE BUSCAS, CERCA DE TI
            </p>
            <h1 className="text-balance text-3xl font-bold leading-[1.1] tracking-tight sm:text-5xl lg:text-6xl">
              Tu barrio tiene<br />
              <span className="text-accent">muchas historias.</span>
            </h1>
            <p className="mt-4 sm:mt-5 max-w-lg text-sm sm:text-base leading-relaxed text-white/75 lg:text-lg">
              Encuentra, vende y vuelve a darle vida a cosas buenas. Entre vecinos, todo se siente más cerca.
            </p>
          </div>

          <div className="mt-8 sm:mt-9 max-w-3xl animate-rise">
            <SearchBar large onSubmit={handleSearch} />

            {/* SELECTOR DESPLEGABLE EN EL HERO */}
            <div className="relative mt-4 flex items-center gap-2 text-xs sm:text-sm text-white/80">
              <MapPin size={16} className="text-accent shrink-0" />
              <span>Explorando</span>
              <button
                type="button"
                onClick={() => setLocationDropdown(!locationDropdown)}
                className="flex items-center gap-1 font-bold text-white underline decoration-secondary underline-offset-4 hover:text-accent transition"
              >
                {selectedLocation}
                <ChevronDown size={14} />
              </button>

              {locationDropdown && (
                <div className="absolute left-0 sm:left-24 top-full mt-2 z-50 w-60 rounded-2xl border bg-card p-2 text-primary shadow-2xl animate-fade max-h-72 overflow-y-auto">
                  <p className="px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-muted-foreground border-b mb-1">
                    Cambiar Barrio / Sector
                  </p>
                  {locations.map((loc) => (
                    <button
                      key={loc}
                      onClick={() => {
                        setSelectedLocation(loc);
                        setLocationDropdown(false);
                      }}
                      className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-xs font-semibold hover:bg-muted ${
                        selectedLocation === loc ? 'bg-secondary/15 text-secondary' : 'text-primary'
                      }`}
                    >
                      {loc}
                      {selectedLocation === loc && <Check size={14} />}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-6xl">
        <section className="py-8 sm:py-9">
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="text-xs sm:text-sm font-semibold text-secondary">Explora tu comuna</p>
              <h2 className="mt-1 text-xl sm:text-2xl font-bold tracking-tight text-primary">
                ¿Qué te gustaría encontrar?
              </h2>
            </div>
            <Link href="/buscar" className="hidden items-center gap-1 text-sm font-bold text-primary sm:flex">
              Ver todo <ChevronRight size={16} />
            </Link>
          </div>
          <div className="mt-5 flex gap-2 overflow-x-auto pb-2 scrollbar-none">
            {categories.map((item) => (
              <button
                key={item}
                onClick={() => setCategory(item)}
                className={`shrink-0 rounded-xl border px-4 py-2.5 text-xs sm:text-sm font-semibold transition hover:-translate-y-0.5 ${
                  category === item
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'bg-card text-primary hover:border-secondary'
                }`}
              >
                {item}
              </button>
            ))}
          </div>
        </section>

        <section className="pb-16">
          <div className="mb-6 flex items-end justify-between">
            <div>
              <p className="text-xs sm:text-sm font-semibold text-secondary">Recién llegados</p>
              <h2 className="mt-1 text-xl sm:text-2xl font-bold tracking-tight text-primary">
                Cosas buenas, cerca
              </h2>
            </div>
            <Link href="/buscar?sort=recent" className="flex items-center gap-1 text-xs sm:text-sm font-bold text-primary">
              Ver todos <ChevronRight size={16} />
            </Link>
          </div>

          {isLoading ? (
            <LoadingBlocks />
          ) : isError ? (
            <StateMessage
              title="No pudimos cargar el barrio"
              body="Revisa tu conexión y vuelve a intentarlo."
              onRetry={() => refetch()}
            />
          ) : listings.length === 0 ? (
            <StateMessage
              title="Todavía no hay publicaciones en esta zona"
              body="Sé la primera persona en compartir algo en esta comuna."
            />
          ) : (
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {featured.map((listing) => (
                <ListingCard key={listing.id} listing={listing} />
              ))}
            </div>
          )}
        </section>

        {/* BANNER ORIGINAL: TU PRIMER AVISO */}
        <section className="mb-16 grid overflow-hidden rounded-3xl bg-secondary p-7 text-white sm:grid-cols-[1.3fr_1fr] sm:p-10">
          <div>
            <p className="text-sm font-bold uppercase tracking-widest text-accent">
              Tu primer aviso
            </p>
            <h2 className="mt-3 max-w-md text-3xl font-bold leading-tight">
              Lo que ya no usas puede ser justo lo que alguien necesita.
            </h2>
            <Link
              href="/publicar"
              className="mt-7 inline-flex items-center gap-2 rounded-xl bg-white px-4 py-3 text-sm font-bold text-primary transition hover:-translate-y-0.5"
            >
              <Plus size={17} />
              Publicar gratis
            </Link>
          </div>
          <div className="relative mt-8 min-h-36 sm:mt-0">
            <div className="absolute right-0 top-0 h-48 w-48 rounded-[2.5rem] border-[18px] border-white/15 rotate-12" />
            <div className="absolute right-16 top-8 h-24 w-24 rounded-full border-[12px] border-accent/50" />
          </div>
        </section>
      </div>
    </div>
  );
}

// --- PÁGINA DE BÚSQUEDA ---

function SearchPage() {
  const params = new URLSearchParams(window.location.search);
  const [term, setTerm] = useState(params.get('q') ?? '');
  const [category, setCategory] = useState(params.get('category') ?? 'Todo');
  const [location, setSearchLocation] = useState(params.get('location') ?? 'Todo Puerto Boyacá');
  const [sort, setSort] = useState(params.get('sort') ?? 'recent');

  const { data: listings = [], isLoading, isError, refetch } = useQuery({
    queryKey: ['listings', term, category, location, sort],
    queryFn: () => fetchListings({ q: term || undefined, category, location, sort }),
  });

  return (
    <div className="py-7 sm:py-9 animate-fade">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="text-xs sm:text-sm font-semibold text-secondary">Explorador local</p>
          <h1 className="mt-1 text-2xl sm:text-3xl font-bold tracking-tight text-primary">Buscar en el barrio</h1>
        </div>
        <Link
          href="/publicar"
          className="inline-flex w-fit items-center gap-2 rounded-xl bg-accent px-4 py-2.5 text-sm font-bold text-primary"
        >
          <Plus size={17} />
          Publicar gratis
        </Link>
      </div>

      <div className="mt-6 sm:mt-8 grid gap-5 lg:grid-cols-[240px_1fr]">
        <aside className="h-fit rounded-2xl border bg-card p-4">
          <div className="mb-4 flex items-center gap-2 font-bold text-primary">
            <SlidersHorizontal size={17} />
            Filtros
          </div>
          <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-muted-foreground">
            Categoría
          </label>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="mb-4 w-full rounded-xl border bg-background px-3 py-2.5 text-sm outline-none"
          >
            {categories.map((item) => (
              <option key={item}>{item}</option>
            ))}
          </select>

          <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-muted-foreground">
            Comuna
          </label>
          <select
            value={location}
            onChange={(e) => setSearchLocation(e.target.value)}
            className="mb-5 w-full rounded-xl border bg-background px-3 py-2.5 text-sm outline-none"
          >
            {locations.map((item) => (
              <option key={item}>{item}</option>
            ))}
          </select>

          <button
            onClick={() => {
              setCategory('Todo');
              setSearchLocation('Toda Bogotá');
              setTerm('');
            }}
            className="w-full rounded-xl border px-3 py-2.5 text-sm font-semibold text-primary hover:bg-muted"
          >
            Limpiar filtros
          </button>
        </aside>

        <div>
          <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <SearchBar initialValue={term} onSubmit={setTerm} />
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value)}
              className="w-full rounded-xl border bg-card px-3 py-3 text-sm font-semibold text-primary outline-none sm:w-48"
            >
              <option value="recent">Más recientes</option>
              <option value="price-low">Precio menor</option>
              <option value="price-high">Precio mayor</option>
            </select>
          </div>

          <p className="mb-5 text-sm text-muted-foreground">
            <span className="font-bold text-primary">{listings.length}</span> resultados para tu búsqueda
          </p>

          {isLoading ? (
            <LoadingBlocks count={6} />
          ) : isError ? (
            <StateMessage
              title="La búsqueda no está disponible"
              body="Revisa tu conexión."
              onRetry={() => refetch()}
            />
          ) : listings.length === 0 ? (
            <StateMessage
              title="No encontramos eso todavía"
              body="Prueba con otra palabra, comuna o categoría."
            />
          ) : (
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
              {listings.map((listing) => (
                <ListingCard key={listing.id} listing={listing} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// --- DETALLE DEL PRODUCTO ---

function DetailPage() {
  const { id = '' } = useParams<{ id: string }>();
  const [activeImage, setActiveImage] = useState(0);

  const { data: listing, isLoading, isError } = useQuery({
    queryKey: ['listing', id],
    queryFn: () => fetchListingById(id),
    enabled: Boolean(id),
  });

  if (isLoading)
    return (
      <div className="py-12">
        <div className="aspect-[4/3] w-full max-w-4xl mx-auto rounded-3xl bg-muted animate-pulse" />
      </div>
    );
  if (isError || !listing)
    return (
      <div className="py-16">
        <StateMessage
          title="Esta publicación no está disponible"
          body="Puede que haya sido retirada o que el enlace esté incompleto."
        />
      </div>
    );

  const images = [listing.image, ...(listing.gallery ?? [])].filter(Boolean);
  const whatsappUrl = listing.seller.phone
    ? `https://wa.me/${listing.seller.phone}?text=${encodeURIComponent(`Hola, me interesa tu publicación: ${listing.title}`)}`
    : '#';
  const whatsappDisplay = listing.seller.phone
    ? `+57 ${listing.seller.phone.replace(/\D/g, '').replace(/^57/, '').replace(/(\d{3})(\d{3})(\d{4})/, '$1 $2 $3')}`
    : '';

  return (
    <div className="py-6 sm:py-8 animate-fade">
      <Link href="/buscar" className="mb-5 inline-flex items-center gap-1 text-sm font-semibold text-muted-foreground hover:text-primary">
        ← Volver a explorar
      </Link>
      <div className="grid gap-8 lg:grid-cols-[1.1fr_.9fr]">
        <div>
          <div className="overflow-hidden rounded-3xl border bg-muted">
            <img
              src={images[activeImage] || placeholderImage}
              alt={listing.title}
              className="aspect-[4/3] w-full object-cover lg:aspect-[1.15/1]"
            />
          </div>
          {images.length > 1 && (
            <div className="mt-3 flex gap-3 overflow-auto pb-2">
              {images.map((image, index) => (
                <button
                  key={image + index}
                  onClick={() => setActiveImage(index)}
                  className={`h-20 w-24 shrink-0 overflow-hidden rounded-xl border-2 ${
                    activeImage === index ? 'border-secondary' : 'border-transparent'
                  }`}
                >
                  <img src={image} alt="" className="h-full w-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>

        <div>
          <span className="rounded-lg bg-accent/20 px-2.5 py-1 text-[11px] font-bold uppercase tracking-widest text-primary">
            {listing.category}
          </span>
          <h1 className="mt-4 text-2xl sm:text-4xl font-bold leading-tight tracking-tight text-primary">
            {listing.title}
          </h1>
          <p className="mt-3 font-mono text-2xl font-bold text-primary">{formatPrice(listing.price)}</p>

          <div className="mt-4 flex flex-wrap items-center gap-3 text-xs sm:text-sm text-muted-foreground">
            <span className="rounded-lg bg-muted px-2.5 py-1 font-semibold text-primary">{listing.condition}</span>
            <span className="flex items-center gap-1">
              <MapPin size={15} />
              {listing.location}
            </span>
            <span>Publicado {formatDate(listing.createdAt).toLowerCase()}</span>
          </div>

          <div className="my-6 border-t" />
          <h2 className="font-bold text-primary">Sobre este artículo</h2>
          <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-muted-foreground">{listing.description}</p>

          <div className="my-6 border-t" />
          <div className="flex items-center gap-3">
            <Avatar name={listing.seller.name} />
            <div>
              <p className="font-bold text-primary">{listing.seller.name}</p>
              <p className="flex items-center gap-1 text-xs text-muted-foreground">
                <Star size={13} fill="currentColor" className="text-accent" />
                {listing.seller.rating.toFixed(1)} · {listing.seller.verified ? 'Identidad verificada' : 'Vendedor del barrio'}
              </p>
            </div>
            {listing.seller.verified && <ShieldCheck size={18} className="ml-auto text-secondary" />}
          </div>

          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <a
              href={whatsappUrl}
              target="_blank"
              rel="noreferrer"
              className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-secondary px-4 py-3.5 text-sm font-bold text-white transition hover:-translate-y-0.5"
            >
              <MessageCircle size={17} />
              Contactar por WhatsApp
            </a>
            <button
              className="flex items-center justify-center gap-2 rounded-xl border px-4 py-3.5 text-sm font-bold text-primary hover:border-secondary transition"
              onClick={() => navigator.clipboard?.writeText(window.location.href)}
            >
              <LinkIcon size={17} />
              Compartir
            </button>
          </div>
          {whatsappDisplay && (
            <p className="mt-2 text-center text-xs text-muted-foreground">
              WhatsApp del vendedor: <span className="font-semibold text-primary">{whatsappDisplay}</span>
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

// --- PUBLICAR PRODUCTO ---

function PublishPage({ currentUser }: { currentUser: any }) {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    title: '',
    category: 'Hogar',
    price: '',
    description: '',
    condition: 'Usado',
    location: 'Centro',
    image: '',
    phone: '',
  });
  const [error, setError] = useState('');

  const create = useMutation({
    mutationFn: (formData: any) => createListingInDb(formData, currentUser),
    onSuccess: (newListing) => {
      queryClient.invalidateQueries({ queryKey: ['listings'] });
      setLocation(`/producto/${newListing.id}`);
    },
    onError: (err: any) => setError(`Error de Supabase: ${err.message}`),
  });

  const update = (key: keyof typeof form, value: string) => setForm((c) => ({ ...c, [key]: value }));

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (form.phone.replace(/\D/g, '').length !== 10) {
      setError('Ingresa un número celular colombiano de 10 dígitos.');
      return;
    }
    if (form.description.length < 10) {
      setError('Cuéntanos un poco más sobre el estado del artículo.');
      return;
    }
    setError('');
    create.mutate(form);
  };

  return (
    <div className="mx-auto max-w-4xl py-7 sm:py-9 animate-fade">
      <div className="mb-6 sm:mb-8">
        <p className="text-xs sm:text-sm font-semibold text-secondary">Tu próximo intercambio</p>
        <h1 className="mt-1 text-2xl sm:text-3xl font-bold tracking-tight text-primary">Publicar algo</h1>
        <p className="mt-2 text-xs sm:text-sm text-muted-foreground">Es gratis, rápido y llega a personas cerca de ti.</p>
      </div>

      <form onSubmit={submit} className="grid gap-6 lg:grid-cols-[1fr_300px]">
        <div className="rounded-3xl border bg-card p-5 sm:p-8">
          <div className="grid gap-4 sm:gap-5 sm:grid-cols-2">
            <label className="sm:col-span-2 text-xs sm:text-sm font-semibold text-primary">
              Título del aviso
              <input
                required
                minLength={3}
                value={form.title}
                onChange={(e) => update('title', e.target.value)}
                placeholder="Ej. Bicicleta urbana casi nueva"
                className="mt-2 w-full rounded-xl border bg-background px-3.5 py-3 text-sm outline-none focus:border-secondary"
              />
            </label>

            <label className="text-xs sm:text-sm font-semibold text-primary">
              Categoría
              <select
                value={form.category}
                onChange={(e) => update('category', e.target.value)}
                className="mt-2 w-full rounded-xl border bg-background px-3.5 py-3 text-sm outline-none focus:border-secondary"
              >
                {categories.slice(1).map((item) => (
                  <option key={item}>{item}</option>
                ))}
              </select>
            </label>

            <label className="text-xs sm:text-sm font-semibold text-primary">
              Precio (COP)
              <input
                required
                min="0"
                type="number"
                value={form.price}
                onChange={(e) => update('price', e.target.value)}
                placeholder="Ej. 450000"
                className="mt-2 w-full rounded-xl border bg-background px-3.5 py-3 text-sm outline-none focus:border-secondary"
              />
            </label>

            <label className="text-xs sm:text-sm font-semibold text-primary">
              Estado
              <select
                value={form.condition}
                onChange={(e) => update('condition', e.target.value)}
                className="mt-2 w-full rounded-xl border bg-background px-3.5 py-3 text-sm outline-none focus:border-secondary"
              >
                <option>Usado</option>
                <option>Nuevo</option>
              </select>
            </label>

            <label className="text-xs sm:text-sm font-semibold text-primary">
              Localidad
              <select
                value={form.location}
                onChange={(e) => update('location', e.target.value)}
                className="mt-2 w-full rounded-xl border bg-background px-3.5 py-3 text-sm outline-none focus:border-secondary"
              >
                {locations.slice(1).map((item) => (
                  <option key={item}>{item}</option>
                ))}
              </select>
            </label>

            <label className="sm:col-span-2 text-xs sm:text-sm font-semibold text-primary">
              Descripción
              <textarea
                required
                minLength={10}
                value={form.description}
                onChange={(e) => update('description', e.target.value)}
                rows={4}
                placeholder="¿Qué incluye?, ¿qué detalles tiene?, ¿por qué lo vendes?"
                className="mt-2 w-full resize-none rounded-xl border bg-background px-3.5 py-3 text-sm outline-none focus:border-secondary"
              />
            </label>

            <label className="sm:col-span-2 text-xs sm:text-sm font-semibold text-primary">
              Tu celular de WhatsApp
              <div className="mt-2 flex overflow-hidden rounded-xl border bg-background focus-within:border-secondary">
                <span className="flex items-center border-r bg-muted px-3 text-xs sm:text-sm font-semibold text-primary">
                  +57
                </span>
                <input
                  required
                  autoComplete="tel"
                  type="tel"
                  maxLength={10}
                  value={form.phone}
                  onChange={(e) => update('phone', e.target.value.replace(/\D/g, '').slice(0, 10))}
                  placeholder="300 123 4567"
                  className="min-w-0 flex-1 px-3.5 py-3 text-sm outline-none"
                />
              </div>
            </label>

            <label className="sm:col-span-2 text-xs sm:text-sm font-semibold text-primary">
              Foto del artículo (URL)
              <input
                type="url"
                value={form.image}
                onChange={(e) => update('image', e.target.value)}
                placeholder="https://images.unsplash.com/..."
                className="mt-2 w-full rounded-xl border bg-background px-3.5 py-3 text-sm outline-none focus:border-secondary"
              />
            </label>
          </div>

          {error && <p className="mt-4 rounded-xl bg-destructive/10 px-3 py-2 text-xs sm:text-sm text-destructive">{error}</p>}

          <div className="mt-7 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <Link
              href="/"
              className="rounded-xl border px-5 py-3 text-center text-sm font-bold text-primary hover:bg-muted"
            >
              Cancelar
            </Link>
            <button
              disabled={create.isPending}
              className="flex items-center justify-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-bold text-primary-foreground transition hover:-translate-y-0.5 disabled:opacity-60"
            >
              {create.isPending && <Loader2 size={17} className="animate-spin" />}
              Publicar aviso
            </button>
          </div>
        </div>

        <aside className="h-fit rounded-3xl bg-primary p-6 text-primary-foreground">
          <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-accent text-primary">
            <ImagePlus size={21} />
          </div>
          <h2 className="text-xl font-bold">Un buen aviso se mueve rápido</h2>
          <ul className="mt-5 space-y-3 text-xs sm:text-sm text-white/75">
            <li className="flex gap-2">
              <Check size={16} className="mt-0.5 shrink-0 text-accent" />
              Usa un título simple y directo.
            </li>
            <li className="flex gap-2">
              <Check size={16} className="mt-0.5 shrink-0 text-accent" />
              Cuenta la verdad sobre el estado.
            </li>
            <li className="flex gap-2">
              <Check size={16} className="mt-0.5 shrink-0 text-accent" />
              Coordina encuentros en sitios públicos.
            </li>
          </ul>
        </aside>
      </form>
    </div>
  );
}

// --- LOGIN / REGISTRO ---

function AuthCard({ register = false }: { register?: boolean }) {
  const [, setLocation] = useLocation();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (register) {
        if (password !== passwordConfirm) {
          setError('Las contraseñas no coinciden.');
          setLoading(false);
          return;
        }
        const { error: signUpError } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { name } },
        });
        if (signUpError) throw signUpError;
      } else {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (signInError) throw signInError;
      }
      setLocation('/');
    } catch (err: any) {
      setError(err.message || 'Error al autenticar');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="grid min-h-[calc(100dvh-180px)] items-center py-10 lg:grid-cols-2 lg:gap-20">
      <div className="hidden lg:block">
        <p className="flex items-center gap-2 text-sm font-bold uppercase tracking-widest text-secondary">
          <ShieldCheck size={16} />
          Un marketplace de vecinos
        </p>
        <h1 className="mt-5 max-w-lg text-5xl font-bold leading-[1.05] tracking-tight text-primary">
          {register ? 'Tu comunidad empieza aquí.' : 'Comprar cerca se siente mejor.'}
        </h1>
        <p className="mt-5 max-w-md text-lg leading-relaxed text-muted-foreground">
          Publica lo que ya no usas, descubre tesoros cerca de ti y conecta con personas de tu zona.
        </p>
      </div>

      <div className="mx-auto w-full max-w-md">
        <div className="rounded-3xl border bg-card p-6 shadow-soft sm:p-9">
          <p className="text-xs sm:text-sm font-semibold text-secondary">
            {register ? 'Únete a TuMarketplace' : 'Tu cuenta'}
          </p>
          <h2 className="mt-2 text-2xl sm:text-3xl font-bold tracking-tight text-primary">
            {register ? 'Crea tu cuenta' : 'Ingresa a tu cuenta'}
          </h2>

          <form onSubmit={submit} className="mt-6 space-y-4">
            {register && (
              <label className="block text-xs sm:text-sm font-semibold text-primary">
                Nombre completo
                <input
                  required
                  minLength={2}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ej. Camila Rojas"
                  className="mt-2 w-full rounded-xl border bg-background px-3.5 py-3 text-sm outline-none focus:border-secondary"
                />
              </label>
            )}
            <label className="block text-xs sm:text-sm font-semibold text-primary">
              Correo electrónico
              <input
                required
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="tu@correo.com"
                className="mt-2 w-full rounded-xl border bg-background px-3.5 py-3 text-sm outline-none focus:border-secondary"
              />
            </label>
            <label className="block text-xs sm:text-sm font-semibold text-primary">
              Contraseña
              <input
                required
                minLength={6}
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Mínimo 6 caracteres"
                className="mt-2 w-full rounded-xl border bg-background px-3.5 py-3 text-sm outline-none focus:border-secondary"
              />
            </label>
            {register && (
              <label className="block text-xs sm:text-sm font-semibold text-primary">
                Confirmar contraseña
                <input
                  required
                  minLength={6}
                  type="password"
                  value={passwordConfirm}
                  onChange={(e) => setPasswordConfirm(e.target.value)}
                  placeholder="Repite la contraseña"
                  className="mt-2 w-full rounded-xl border bg-background px-3.5 py-3 text-sm outline-none focus:border-secondary"
                />
              </label>
            )}

            {error && <p className="rounded-xl bg-destructive/10 px-3 py-2 text-xs sm:text-sm text-destructive">{error}</p>}

            <button
              disabled={loading}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3.5 font-bold text-primary-foreground transition hover:-translate-y-0.5 disabled:opacity-60"
            >
              {loading && <Loader2 size={17} className="animate-spin" />}
              {register ? 'Crear cuenta' : 'Ingresar'}
            </button>
          </form>

          <p className="mt-6 text-center text-xs sm:text-sm text-muted-foreground">
            {register ? '¿Ya tienes cuenta? ' : '¿Aún no tienes cuenta? '}
            <Link href={register ? '/login' : '/registro'} className="font-bold text-secondary hover:underline">
              {register ? 'Ingresar' : 'Crear cuenta'}
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

// --- ROUTER PRINCIPAL ---

function Router() {
  const [currentUser, setCurrentUser] = useState<any>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setCurrentUser(data.user));
    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      setCurrentUser(session?.user ?? null);
    });
    return () => authListener.subscription.unsubscribe();
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setCurrentUser(null);
  };

  return (
    <AppShell currentUser={currentUser} onLogout={handleLogout}>
      <Switch>
        <Route path="/" component={Home} />
        <Route path="/buscar" component={SearchPage} />
        <Route path="/producto/:id" component={DetailPage} />
        <Route path="/publicar">
          <PublishPage currentUser={currentUser} />
        </Route>
        <Route path="/login">
          <AuthCard />
        </Route>
        <Route path="/registro">
          <AuthCard register />
        </Route>
        <Route>
          <div className="py-20 text-center">
            <StateMessage title="Página no encontrada" body="La página solicitada no existe." />
          </div>
        </Route>
      </Switch>
    </AppShell>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Router />
    </QueryClientProvider>
  );
}