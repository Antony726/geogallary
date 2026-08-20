/**
 * EXIF & Media Metadata Extraction Service
 * Uses ExifReader to parse EXIF, GPS, camera, and date info from images & videos
 */

import { geoService } from './geoService.js';
import { CONFIG } from '../config.js';

class ExifService {
  /**
   * Parse a File object and extract all metadata, date, GPS, and camera specs
   */
  async extractMetadata(file) {
    const isVideo = file.type.startsWith('video/');
    const defaultDate = file.lastModified ? new Date(file.lastModified).toISOString() : new Date().toISOString();

    const baseResult = {
      fileName: file.name,
      fileSize: file.size,
      mimeType: file.type || (isVideo ? 'video/mp4' : 'image/jpeg'),
      mediaType: isVideo ? 'video' : 'image',
      dateTaken: defaultDate,
      latitude: null,
      longitude: null,
      hasGps: false,
      hasExifDate: false,
      locationName: CONFIG.DEFAULT_LOCATION.name,
      district: CONFIG.DEFAULT_LOCATION.district || 'Chennai',
      city: CONFIG.DEFAULT_LOCATION.city,
      state: CONFIG.DEFAULT_LOCATION.state || 'Tamil Nadu',
      country: CONFIG.DEFAULT_LOCATION.country,
      exif: {
        make: 'Unknown',
        model: 'Unknown',
        lens: '',
        iso: '',
        focalLength: '',
        fNumber: '',
        exposureTime: '',
        dimensions: ''
      }
    };

    if (isVideo) {
      // For videos, attempt basic metadata or use file timestamp
      return baseResult;
    }

    try {
      if (typeof window.ExifReader === 'undefined') {
        console.warn('ExifReader library not loaded, using fallback timestamp');
        return baseResult;
      }

      // Read file buffer for ExifReader
      const tags = await window.ExifReader.load(file, { expanded: true });

      // 1. Extract Capture Date
      let extractedDate = null;
      if (tags.exif) {
        const dtOriginal = tags.exif.DateTimeOriginal ? tags.exif.DateTimeOriginal.description : null;
        const dtDigitized = tags.exif.DateTimeDigitized ? tags.exif.DateTimeDigitized.description : null;
        const dtModify = tags.exif.DateTime ? tags.exif.DateTime.description : null;

        const dateStr = dtOriginal || dtDigitized || dtModify;
        if (dateStr) {
          extractedDate = this.parseExifDateString(dateStr);
        }
      }

      if (extractedDate) {
        baseResult.dateTaken = extractedDate.toISOString();
        baseResult.hasExifDate = true;
      }

      // 2. Extract GPS Coordinates
      if (tags.gps && tags.gps.Latitude != null && tags.gps.Longitude != null) {
        baseResult.latitude = tags.gps.Latitude;
        baseResult.longitude = tags.gps.Longitude;
        baseResult.hasGps = true;

        // Auto reverse geocode coordinates
        const geoInfo = await geoService.reverseGeocode(baseResult.latitude, baseResult.longitude);
        baseResult.locationName = geoInfo.name;
        baseResult.district = geoInfo.district;
        baseResult.city = geoInfo.city;
        baseResult.state = geoInfo.state;
        baseResult.country = geoInfo.country;
      }

      // 3. Extract Camera & Lens details
      if (tags.exif) {
        const makeDesc = (tags.exif.Make && tags.exif.Make.description) || (tags.image && tags.image.Make && tags.image.Make.description) || 'Unknown Camera';
        const modelDesc = (tags.exif.Model && tags.exif.Model.description) || (tags.image && tags.image.Model && tags.image.Model.description) || '';
        const lensDesc = (tags.exif.LensModel && tags.exif.LensModel.description) || '';
        const isoDesc = (tags.exif.ISOSpeedRatings && tags.exif.ISOSpeedRatings.description) || (tags.exif.PhotographicSensitivity && tags.exif.PhotographicSensitivity.description) || '';
        const focalDesc = (tags.exif.FocalLength && tags.exif.FocalLength.description) || '';
        const fNumDesc = (tags.exif.FNumber && tags.exif.FNumber.description) ? `f/${tags.exif.FNumber.description}` : '';
        const expDesc = (tags.exif.ExposureTime && tags.exif.ExposureTime.description) || '';

        baseResult.exif.make = makeDesc;
        baseResult.exif.model = modelDesc;
        baseResult.exif.lens = lensDesc;
        baseResult.exif.iso = isoDesc;
        baseResult.exif.focalLength = focalDesc;
        baseResult.exif.fNumber = fNumDesc;
        baseResult.exif.exposureTime = expDesc;
      }

      // 4. Image Dimensions
      const width = (tags.file && tags.file['Image Width'] && tags.file['Image Width'].description) || (tags.image && tags.image.ImageWidth && tags.image.ImageWidth.description);
      const height = (tags.file && tags.file['Image Height'] && tags.file['Image Height'].description) || (tags.image && tags.image.ImageLength && tags.image.ImageLength.description);
      if (width && height) {
        baseResult.exif.dimensions = `${width} x ${height}`;
      }

      return baseResult;

    } catch (error) {
      console.warn(`Error reading EXIF from ${file.name}:`, error);
      return baseResult;
    }
  }

  /**
   * Parse EXIF date strings (e.g. "2024:05:18 19:15:00") into JavaScript Date
   */
  parseExifDateString(str) {
    if (!str || typeof str !== 'string') return null;
    try {
      // Standard format: YYYY:MM:DD HH:MM:SS
      const parts = str.trim().split(' ');
      if (parts.length >= 1) {
        const dateParts = parts[0].split(':');
        if (dateParts.length === 3) {
          const year = parseInt(dateParts[0], 10);
          const month = parseInt(dateParts[1], 10) - 1;
          const day = parseInt(dateParts[2], 10);

          let hours = 12, mins = 0, secs = 0;
          if (parts[1]) {
            const timeParts = parts[1].split(':');
            hours = parseInt(timeParts[0], 10) || 0;
            mins = parseInt(timeParts[1], 10) || 0;
            secs = parseInt(timeParts[2], 10) || 0;
          }

          const date = new Date(Date.UTC(year, month, day, hours, mins, secs));
          if (!isNaN(date.getTime())) {
            return date;
          }
        }
      }
      
      // Fallback standard parse
      const fallback = new Date(str);
      return !isNaN(fallback.getTime()) ? fallback : null;
    } catch (e) {
      return null;
    }
  }
}

export const exifService = new ExifService();
