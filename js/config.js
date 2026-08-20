/**
 * GeoTimeline Configuration and Sample Data Generator
 */

export const CONFIG = {
  APP_NAME: 'GeoTimeline Photos',
  VERSION: '1.0.0',
  DB_NAME: 'GeoTimelineDB',
  DB_VERSION: 2,
  
  STORAGE_KEYS: {
    PROVIDER: 'geotimeline_storage_provider', // 'local' | 'gdrive' | 'demo'
    GDRIVE_FOLDER_LINK: 'geotimeline_gdrive_folder_link',
    GDRIVE_FOLDER_ID: 'geotimeline_gdrive_folder_id',
    GDRIVE_CLIENT_ID: 'geotimeline_gdrive_client_id',
    GDRIVE_WEBHOOK_URL: 'geotimeline_gdrive_webhook_url',
    GDRIVE_ACCESS_TOKEN: 'geotimeline_gdrive_token',
    LOCAL_ROOT_NAME: 'geotimeline_local_root_name',
    HOME_LOCATION: 'geotimeline_home_location',
    TRIP_DISTANCE_THRESHOLD: 'geotimeline_trip_distance_threshold',
    FIRST_RUN_DONE: 'geotimeline_first_run_done',
    THEME: 'geotimeline_theme'
  },

  // 1-Time Master Google Drive API Configuration (Everyone uploads here automatically)
  DEFAULT_GDRIVE_FOLDER_ID: '1P8AFBFU2hkvBz1fpavHPll1EAcqK4idI',
  DEFAULT_GDRIVE_FOLDER_LINK: 'https://drive.google.com/drive/folders/1P8AFBFU2hkvBz1fpavHPll1EAcqK4idI',
  DEFAULT_GDRIVE_WEBHOOK_URL: '', // Paste your deployed Google Apps Script URL here once, and every user can upload automatically!

  DEFAULT_LOCATION: {
    name: 'Chennai, Tamil Nadu',
    district: 'Chennai',
    city: 'Chennai',
    state: 'Tamil Nadu',
    country: 'India',
    lat: 13.0827,
    lng: 80.2707
  },

  NOMINATIM_BASE_URL: 'https://nominatim.openstreetmap.org',
  GDRIVE_API_BASE: 'https://www.googleapis.com/drive/v3',
  GDRIVE_UPLOAD_BASE: 'https://www.googleapis.com/upload/drive/v3/files'
};

/**
 * High quality sample memory datasets featuring authentic Tamil Nadu & India destinations
 */
export const SAMPLE_MEMORIES = [
  {
    id: 'tn-sample-1',
    fileName: 'marina_beach_chennai_sunrise.jpg',
    fileSize: 2850000,
    mimeType: 'image/jpeg',
    mediaType: 'image',
    dateTaken: '2024-05-10T06:15:00Z',
    year: '2024',
    yearMonth: '2024-05',
    day: '2024-05-10',
    locationName: 'Marina Beach, Chennai, Tamil Nadu',
    district: 'Chennai',
    city: 'Chennai',
    state: 'Tamil Nadu',
    country: 'India',
    latitude: 13.0499,
    longitude: 80.2824,
    storagePath: 'Marina Beach, Chennai, Tamil Nadu/2024-05/marina_beach_chennai_sunrise.jpg',
    url: 'https://images.unsplash.com/photo-1582510003544-4d00b7f74220?auto=format&fit=crop&w=1200&q=80',
    thumbUrl: 'https://images.unsplash.com/photo-1582510003544-4d00b7f74220?auto=format&fit=crop&w=400&q=80',
    exif: {
      make: 'Sony',
      model: 'ILCE-7M4',
      lens: 'FE 24-70mm F2.8 GM',
      iso: 100,
      focalLength: '35mm',
      fNumber: 'f/4.0',
      exposureTime: '1/500s',
      dimensions: '4000 x 3000'
    }
  },
  {
    id: 'tn-sample-2',
    fileName: 'meenakshi_amman_temple_madurai.jpg',
    fileSize: 3420000,
    mimeType: 'image/jpeg',
    mediaType: 'image',
    dateTaken: '2024-04-18T17:30:00Z',
    year: '2024',
    yearMonth: '2024-04',
    day: '2024-04-18',
    locationName: 'Madurai Meenakshi Temple, Tamil Nadu',
    district: 'Madurai',
    city: 'Madurai',
    state: 'Tamil Nadu',
    country: 'India',
    latitude: 9.9195,
    longitude: 78.1193,
    storagePath: 'Madurai Meenakshi Temple, Tamil Nadu/2024-04/meenakshi_amman_temple_madurai.jpg',
    url: 'https://images.unsplash.com/photo-1609766857041-ed402ea8069a?auto=format&fit=crop&w=1200&q=80',
    thumbUrl: 'https://images.unsplash.com/photo-1609766857041-ed402ea8069a?auto=format&fit=crop&w=400&q=80',
    exif: {
      make: 'Canon',
      model: 'EOS R6',
      lens: 'RF 24-105mm F4 L IS USM',
      iso: 400,
      focalLength: '24mm',
      fNumber: 'f/5.6',
      exposureTime: '1/250s',
      dimensions: '5472 x 3648'
    }
  },
  {
    id: 'tn-sample-3',
    fileName: 'ooty_nilgiri_tea_gardens.jpg',
    fileSize: 3120000,
    mimeType: 'image/jpeg',
    mediaType: 'image',
    dateTaken: '2024-03-22T09:40:00Z',
    year: '2024',
    yearMonth: '2024-03',
    day: '2024-03-22',
    locationName: 'Ooty Nilgiris, Tamil Nadu',
    district: 'Nilgiris',
    city: 'Ooty',
    state: 'Tamil Nadu',
    country: 'India',
    latitude: 11.4102,
    longitude: 76.6950,
    storagePath: 'Ooty Nilgiris, Tamil Nadu/2024-03/ooty_nilgiri_tea_gardens.jpg',
    url: 'https://images.unsplash.com/photo-1544735716-392fe2489ffa?auto=format&fit=crop&w=1200&q=80',
    thumbUrl: 'https://images.unsplash.com/photo-1544735716-392fe2489ffa?auto=format&fit=crop&w=400&q=80',
    exif: {
      make: 'Apple',
      model: 'iPhone 15 Pro',
      lens: 'iPhone 15 Pro back camera 24mm f/1.78',
      iso: 64,
      focalLength: '24mm',
      fNumber: 'f/1.78',
      exposureTime: '1/1200s',
      dimensions: '4032 x 3024'
    }
  },
  {
    id: 'tn-sample-4',
    fileName: 'shore_temple_mahabalipuram.jpg',
    fileSize: 2950000,
    mimeType: 'image/jpeg',
    mediaType: 'image',
    dateTaken: '2024-02-14T16:45:00Z',
    year: '2024',
    yearMonth: '2024-02',
    day: '2024-02-14',
    locationName: 'Mahabalipuram Shore Temple, Tamil Nadu',
    district: 'Chengalpattu',
    city: 'Mahabalipuram',
    state: 'Tamil Nadu',
    country: 'India',
    latitude: 12.6163,
    longitude: 80.1983,
    storagePath: 'Mahabalipuram Shore Temple, Tamil Nadu/2024-02/shore_temple_mahabalipuram.jpg',
    url: 'https://images.unsplash.com/photo-1590050752117-238cb0fb12b1?auto=format&fit=crop&w=1200&q=80',
    thumbUrl: 'https://images.unsplash.com/photo-1590050752117-238cb0fb12b1?auto=format&fit=crop&w=400&q=80',
    exif: {
      make: 'Nikon',
      model: 'Z 7II',
      lens: 'NIKKOR Z 24-70mm f/2.8 S',
      iso: 200,
      focalLength: '28mm',
      fNumber: 'f/4.5',
      exposureTime: '1/640s',
      dimensions: '8256 x 5504'
    }
  },
  {
    id: 'tn-sample-5',
    fileName: 'brihadeeswarar_thanjavur_temple.jpg',
    fileSize: 3680000,
    mimeType: 'image/jpeg',
    mediaType: 'image',
    dateTaken: '2024-01-20T11:10:00Z',
    year: '2024',
    yearMonth: '2024-01',
    day: '2024-01-20',
    locationName: 'Brihadeeswarar Temple, Thanjavur, Tamil Nadu',
    district: 'Thanjavur',
    city: 'Thanjavur',
    state: 'Tamil Nadu',
    country: 'India',
    latitude: 10.7828,
    longitude: 79.1318,
    storagePath: 'Brihadeeswarar Temple, Thanjavur, Tamil Nadu/2024-01/brihadeeswarar_thanjavur_temple.jpg',
    url: 'https://images.unsplash.com/photo-1600100397608-f010e421d4d0?auto=format&fit=crop&w=1200&q=80',
    thumbUrl: 'https://images.unsplash.com/photo-1600100397608-f010e421d4d0?auto=format&fit=crop&w=400&q=80',
    exif: {
      make: 'Sony',
      model: 'ILCE-7M4',
      lens: 'FE 16-35mm F2.8 GM',
      iso: 160,
      focalLength: '18mm',
      fNumber: 'f/8.0',
      exposureTime: '1/320s',
      dimensions: '4000 x 3000'
    }
  },
  {
    id: 'tn-sample-6',
    fileName: 'kanyakumari_vivekananda_rock.jpg',
    fileSize: 2790000,
    mimeType: 'image/jpeg',
    mediaType: 'image',
    dateTaken: '2023-12-25T17:50:00Z',
    year: '2023',
    yearMonth: '2023-12',
    day: '2023-12-25',
    locationName: 'Vivekananda Rock, Kanyakumari, Tamil Nadu',
    district: 'Kanyakumari',
    city: 'Kanyakumari',
    state: 'Tamil Nadu',
    country: 'India',
    latitude: 8.0780,
    longitude: 77.5550,
    storagePath: 'Vivekananda Rock, Kanyakumari, Tamil Nadu/2023-12/kanyakumari_vivekananda_rock.jpg',
    url: 'https://images.unsplash.com/photo-1599818816949-a03525232936?auto=format&fit=crop&w=1200&q=80',
    thumbUrl: 'https://images.unsplash.com/photo-1599818816949-a03525232936?auto=format&fit=crop&w=400&q=80',
    exif: {
      make: 'Fujifilm',
      model: 'X-T4',
      lens: 'XF 16-55mm F2.8 R LM WR',
      iso: 200,
      focalLength: '35mm',
      fNumber: 'f/4.0',
      exposureTime: '1/400s',
      dimensions: '6240 x 4160'
    }
  },
  {
    id: 'tn-sample-7',
    fileName: 'pamban_bridge_rameswaram.jpg',
    fileSize: 3250000,
    mimeType: 'image/jpeg',
    mediaType: 'image',
    dateTaken: '2023-11-15T08:20:00Z',
    year: '2023',
    yearMonth: '2023-11',
    day: '2023-11-15',
    locationName: 'Pamban Bridge, Rameswaram, Tamil Nadu',
    district: 'Ramanathapuram',
    city: 'Rameswaram',
    state: 'Tamil Nadu',
    country: 'India',
    latitude: 9.2827,
    longitude: 79.2064,
    storagePath: 'Pamban Bridge, Rameswaram, Tamil Nadu/2023-11/pamban_bridge_rameswaram.jpg',
    url: 'https://images.unsplash.com/photo-1627894483216-2138af692e32?auto=format&fit=crop&w=1200&q=80',
    thumbUrl: 'https://images.unsplash.com/photo-1627894483216-2138af692e32?auto=format&fit=crop&w=400&q=80',
    exif: {
      make: 'Apple',
      model: 'iPhone 15 Pro',
      lens: 'iPhone 15 Pro back camera',
      iso: 80,
      focalLength: '24mm',
      fNumber: 'f/1.78',
      exposureTime: '1/1600s',
      dimensions: '4032 x 3024'
    }
  },
  {
    id: 'tn-sample-8',
    fileName: 'kodaikanal_lake_hills.jpg',
    fileSize: 3010000,
    mimeType: 'image/jpeg',
    mediaType: 'image',
    dateTaken: '2023-10-05T15:30:00Z',
    year: '2023',
    yearMonth: '2023-10',
    day: '2023-10-05',
    locationName: 'Kodaikanal Lake & Hills, Tamil Nadu',
    district: 'Dindigul',
    city: 'Kodaikanal',
    state: 'Tamil Nadu',
    country: 'India',
    latitude: 10.2381,
    longitude: 77.4892,
    storagePath: 'Kodaikanal Lake & Hills, Tamil Nadu/2023-10/kodaikanal_lake_hills.jpg',
    url: 'https://images.unsplash.com/photo-1589182373726-e4f658ab50f0?auto=format&fit=crop&w=1200&q=80',
    thumbUrl: 'https://images.unsplash.com/photo-1589182373726-e4f658ab50f0?auto=format&fit=crop&w=400&q=80',
    exif: {
      make: 'Canon',
      model: 'EOS R6',
      lens: 'RF 24-105mm F4 L IS USM',
      iso: 250,
      focalLength: '50mm',
      fNumber: 'f/5.6',
      exposureTime: '1/320s',
      dimensions: '5472 x 3648'
    }
  }
];

/**
 * Format bytes to readable human string
 */
export function formatBytes(bytes, decimals = 1) {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

/**
 * Format date to human friendly string
 */
export function formatDate(isoString) {
  if (!isoString) return 'Unknown Date';
  const d = new Date(isoString);
  if (isNaN(d.getTime())) return 'Unknown Date';
  return d.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
}

/**
 * Sleek SVG Fallback for offline or missing images
 */
export const FALLBACK_IMAGE_DATA_URI = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 400 300' width='100%25' height='100%25'%3E%3Crect width='100%25' height='100%25' fill='%23141414'/%3E%3Cg fill='none' stroke='%23FF4500' stroke-width='2' stroke-linecap='round' stroke-linejoin='round' transform='translate(176, 126)' opacity='0.8'%3E%3Cpath d='M14.5 4h3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6.5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h3l2-3h5l2 3z'/%3E%3Ccircle cx='12' cy='13' r='4'/%3E%3C/g%3E%3Ctext x='50%25' y='65%25' font-family='sans-serif' font-size='12' fill='%2371717a' text-anchor='middle'%3EMemory Media%3C/text%3E%3C/svg%3E";

/**
 * Resolve working live URL for a media record (handling memory Blob, fresh ObjectURL, or remote HTTP URL)
 */
export function resolveMediaUrl(item) {
  if (!item) return FALLBACK_IMAGE_DATA_URI;

  // 1. If item has a Blob or File instance, prioritize creating a fresh object URL
  if (item.fileBlob && (item.fileBlob instanceof Blob || item.fileBlob instanceof File)) {
    if (!item._blobUrl) {
      try {
        item._blobUrl = URL.createObjectURL(item.fileBlob);
      } catch (e) {
        console.warn('Could not generate object URL for blob:', e);
      }
    }
    if (item._blobUrl) return item._blobUrl;
  }

  // 2. If active in-memory object URL already created
  if (item._blobUrl && typeof item._blobUrl === 'string') {
    return item._blobUrl;
  }

  // 3. If item has an external or data URL
  if (item.url && typeof item.url === 'string' && (item.url.startsWith('http://') || item.url.startsWith('https://') || item.url.startsWith('data:'))) {
    return item.url;
  }

  // 4. If item has a valid external thumbUrl
  if (item.thumbUrl && typeof item.thumbUrl === 'string' && (item.thumbUrl.startsWith('http://') || item.thumbUrl.startsWith('https://') || item.thumbUrl.startsWith('data:'))) {
    return item.thumbUrl;
  }

  return FALLBACK_IMAGE_DATA_URI;
}

/**
 * Show a floating toast notification
 */
export function showToast(message, type = 'info', duration = 3500) {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  
  let iconClass = 'fa-circle-info';
  if (type === 'success') iconClass = 'fa-circle-check';
  if (type === 'warning') iconClass = 'fa-triangle-exclamation';
  if (type === 'danger') iconClass = 'fa-circle-exclamation';

  toast.innerHTML = `
    <i class="fa-solid ${iconClass}"></i>
    <span>${message}</span>
  `;

  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(50px)';
    toast.style.transition = 'all 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, duration);
}

