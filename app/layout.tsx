import type { Metadata } from 'next'
import './globals.css'
import { auth } from '@/lib/auth'
import SessionProvider from '@/components/SessionProvider'
import AppLayout from '@/components/AppLayout'

export const metadata: Metadata = {
  title: 'Waqasalee.com — Niche Research Tool',
  description: 'Find profitable YouTube niches with outlier channel analysis',
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const session = await auth()

  return (
    <html lang="en">
      <head>
        <script dangerouslySetInnerHTML={{
          __html: `
(function(){
  var t=localStorage.getItem('niche-theme')||'light';
  if(t==='dark')document.documentElement.classList.add('dark');
  // Suppress Chrome extension "Failed to fetch" errors — only affects dev overlay
  var _onerror=window.onerror;
  window.onerror=function(msg,src){
    if(src&&src.includes('chrome-extension://'))return true;
    return _onerror&&_onerror.apply(this,arguments);
  };
  window.addEventListener('unhandledrejection',function(e){
    var s=String((e.reason&&(e.reason.stack||e.reason.message))||e.reason||'');
    if(s.includes('chrome-extension://')||s.includes('Failed to fetch')){
      e.preventDefault();e.stopImmediatePropagation();
    }
  },true);
  window.addEventListener('error',function(e){
    if(e.filename&&e.filename.includes('chrome-extension://'))e.stopImmediatePropagation();
  },true);
})()
          `
        }} />
      </head>
      <body>
        <SessionProvider session={session}>
          <AppLayout>{children}</AppLayout>
        </SessionProvider>
      </body>
    </html>
  )
}
