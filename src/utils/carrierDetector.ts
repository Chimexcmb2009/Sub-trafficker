import { ISPName } from '../types';

/**
 * Dynamically queries public, highly-available geolocation and IP connection lookup APIs 
 * to determine the user's real-time active carrier network/ISP connection.
 * Avoids simulation by performing live, real-time fetching.
 */
export async function detectCarrierRealTime(): Promise<ISPName> {
  // Option 1: Try modern Connection Network Information API if available (helps on some devices)
  try {
    const conn = (navigator as any).connection || (navigator as any).mozConnection || (navigator as any).webkitConnection;
    if (conn && conn.type === 'cellular') {
      // In some hybrid mobile wrappers or advanced browsers, we can inspect more details
      console.log('Cellular connection type detected on client.');
    }
  } catch (e) {
    // Ignore and proceed to real IP lookup
  }

  // Option 2: Primary lookup via ipwho.is (fast, HTTPS-enabled, returns connections details)
  try {
    const res = await fetch('https://ipwho.is/');
    if (res.ok) {
      const data = await res.json();
      if (data && data.success && data.connection) {
        const ispText = (data.connection.isp || data.connection.org || '').toLowerCase();
        console.log('Primary real-time ISP detected:', data.connection.isp);
        if (ispText.includes('mtn')) return 'MTN';
        if (ispText.includes('airtel')) return 'Airtel';
        if (ispText.includes('glo') || ispText.includes('globacom')) return 'Glo';
        if (ispText.includes('9mobile') || ispText.includes('etisalat')) return '9mobile';
      }
    }
  } catch (err) {
    console.warn('Primary ISP detection failed, trying fallback...', err);
  }

  // Option 3: Fallback lookup via ipapi.co (standard fallback)
  try {
    const res = await fetch('https://ipapi.co/json/');
    if (res.ok) {
      const data = await res.json();
      if (data && data.org) {
        const ispText = data.org.toLowerCase();
        console.log('Fallback real-time ISP detected:', data.org);
        if (ispText.includes('mtn')) return 'MTN';
        if (ispText.includes('airtel')) return 'Airtel';
        if (ispText.includes('glo') || ispText.includes('globacom')) return 'Glo';
        if (ispText.includes('9mobile') || ispText.includes('etisalat')) return '9mobile';
      }
    }
  } catch (err) {
    console.warn('Fallback ISP detection failed:', err);
  }

  // Option 4: Fallback to ip-api.com
  try {
    const res = await fetch('https://ip-api.com/json/');
    if (res.ok) {
      const data = await res.json();
      if (data && data.isp) {
        const ispText = data.isp.toLowerCase();
        console.log('Alternative real-time ISP detected:', data.isp);
        if (ispText.includes('mtn')) return 'MTN';
        if (ispText.includes('airtel')) return 'Airtel';
        if (ispText.includes('glo') || ispText.includes('globacom')) return 'Glo';
        if (ispText.includes('9mobile') || ispText.includes('etisalat')) return '9mobile';
      }
    }
  } catch (err) {
    console.warn('Alternative ISP detection failed:', err);
  }

  return 'MTN'; // Default if all geo-lookups fail or user is on custom Wifi/broadband
}
