import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

describe('Manifest and Asset Packaging', () => {
  const rootDir = path.resolve(__dirname, '..');
  const manifestPath = path.join(rootDir, 'manifest.json');

  it('should load a valid Manifest V3 json file', () => {
    expect(fs.existsSync(manifestPath)).toBe(true);
    const content = fs.readFileSync(manifestPath, 'utf8');
    const manifest = JSON.parse(content);

    expect(manifest.manifest_version).toBe(3);
    expect(manifest.name).toBeTruthy();
    expect(manifest.version).toBe('1.0.0');
    expect(manifest.background?.service_worker).toBeTruthy();
  });

  it('should define valid icons in manifest and action', () => {
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

    expect(manifest.icons).toBeDefined();
    expect(manifest.icons['16']).toBe('assets/icons/icon-16.png');
    expect(manifest.icons['32']).toBe('assets/icons/icon-32.png');
    expect(manifest.icons['48']).toBe('assets/icons/icon-48.png');
    expect(manifest.icons['128']).toBe('assets/icons/icon-128.png');

    expect(manifest.action?.default_icon).toBeDefined();
    expect(manifest.action.default_icon['16']).toBe('assets/icons/icon-16.png');
    expect(manifest.action.default_icon['32']).toBe('assets/icons/icon-32.png');
    expect(manifest.action.default_icon['48']).toBe('assets/icons/icon-48.png');
    expect(manifest.action.default_icon['128']).toBe('assets/icons/icon-128.png');
  });

  it('should verify all icon files exist with valid PNG signatures and dimensions', () => {
    const pngSignature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    const sizes = [16, 32, 48, 128];

    for (const size of sizes) {
      const iconPath = path.join(rootDir, `assets/icons/icon-${size}.png`);
      expect(fs.existsSync(iconPath)).toBe(true);

      const buf = fs.readFileSync(iconPath);
      expect(buf.subarray(0, 8)).toEqual(pngSignature);

      // IHDR width and height at byte offsets 16 and 20
      const width = buf.readUInt32BE(16);
      const height = buf.readUInt32BE(20);
      expect(width).toBe(size);
      expect(height).toBe(size);
    }

    const svgPath = path.join(rootDir, 'assets/icons/icon.svg');
    expect(fs.existsSync(svgPath)).toBe(true);
    const svgContent = fs.readFileSync(svgPath, 'utf8');
    expect(svgContent).toContain('<svg');
    expect(svgContent).toContain('#10b981');
    expect(svgContent).toContain('#38bdf8');
  });

  it('should ensure all referenced entry points exist on disk', () => {
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

    const serviceWorkerPath = path.join(rootDir, manifest.background.service_worker);
    expect(fs.existsSync(serviceWorkerPath)).toBe(true);

    const optionsPath = path.join(rootDir, manifest.options_ui.page);
    expect(fs.existsSync(optionsPath)).toBe(true);

    const offscreenHtmlPath = path.join(rootDir, 'src/offscreen/offscreen.html');
    expect(fs.existsSync(offscreenHtmlPath)).toBe(true);

    const floatingHudPath = path.join(rootDir, 'src/ui/floating-hud.js');
    expect(fs.existsSync(floatingHudPath)).toBe(true);
  });
});
