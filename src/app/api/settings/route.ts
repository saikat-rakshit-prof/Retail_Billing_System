import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { settings } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

export async function GET() {
  try {
    console.log('🔄 Fetching settings...');
    const allSettings = await db.select().from(settings);
    console.log('⚙️ Settings count:', allSettings.length);
    
    if (allSettings.length === 0) {
      // Create default settings if none exist
      const [newSettings] = await db.insert(settings).values({
        shopName: 'FrostyFlow',
        shopPhone: '',
        shopAddress: '',
        taxRate: '0',
      }).returning();
      
      // Map to response
      const response = {
        shopName: newSettings.shopName,
        ownerName: newSettings.ownerName,
        shopPhone: newSettings.shopPhone,
        shopAddress: newSettings.shopAddress,
        taxRate: Number(newSettings.taxRate) || 0,
        currency: newSettings.currency || 'INR',
        lowStockDefaultThreshold: newSettings.lowStockDefaultThreshold || 50,
      };
      
      console.log('✅ Default settings created');
      return NextResponse.json(response);
    }
    
    // Map database fields to API response
    const settingsData = allSettings[0];
    const response = {
      shopName: settingsData.shopName,
      ownerName: settingsData.ownerName,
      shopPhone: settingsData.shopPhone,
      shopAddress: settingsData.shopAddress,
      taxRate: Number(settingsData.taxRate) || 0,
      currency: settingsData.currency || 'INR',
      lowStockDefaultThreshold: settingsData.lowStockDefaultThreshold || 50,
    };
    
    console.log('✅ Settings fetched');
    return NextResponse.json(response);
  } catch (error) {
    console.error('❌ Settings API Error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: String(error) },
      { status: 500 }
    );
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const { shopName, ownerName, shopPhone, shopAddress, taxRate, currency, lowStockDefaultThreshold } = body;
    
    console.log('🔄 Updating settings...');
    
    // Get current settings
    const allSettings = await db.select().from(settings);
    
    if (allSettings.length === 0) {
      // Create settings if none exist
      const [newSettings] = await db.insert(settings).values({
        shopName: shopName || 'FrostyFlow',
        ownerName: ownerName || null,
        shopPhone: shopPhone || null,
        shopAddress: shopAddress || null,
        taxRate: taxRate?.toString() || '0',
        currency: currency || 'INR',
        lowStockDefaultThreshold: lowStockDefaultThreshold || 50,
      }).returning();
      
      console.log('✅ Settings created');
      return NextResponse.json(newSettings);
    }
    
    const currentSettings = allSettings[0];
    const settingsId = currentSettings.id;
    
    // Update settings
    await db.update(settings).set({
      shopName: shopName || currentSettings.shopName,
      ownerName: ownerName !== undefined ? ownerName : currentSettings.ownerName,
      shopPhone: shopPhone !== undefined ? shopPhone : currentSettings.shopPhone,
      shopAddress: shopAddress !== undefined ? shopAddress : currentSettings.shopAddress,
      taxRate: taxRate !== undefined ? taxRate.toString() : currentSettings.taxRate,
      currency: currency || currentSettings.currency,
      lowStockDefaultThreshold: lowStockDefaultThreshold || currentSettings.lowStockDefaultThreshold,
      updatedAt: new Date(),
    }).where(eq(settings.id, settingsId));
    
    // Fetch updated settings
    const [updatedSettings] = await db.select().from(settings).where(eq(settings.id, settingsId));
    
    // Map database fields to API response
    const response = {
      shopName: updatedSettings.shopName,
      ownerName: updatedSettings.ownerName,
      shopPhone: updatedSettings.shopPhone,
      shopAddress: updatedSettings.shopAddress,
      taxRate: Number(updatedSettings.taxRate) || 0,
      currency: updatedSettings.currency || 'INR',
      lowStockDefaultThreshold: updatedSettings.lowStockDefaultThreshold || 50,
    };
    
    console.log('✅ Settings updated');
    return NextResponse.json(response);
  } catch (error) {
    console.error('❌ Settings PUT Error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: String(error) },
      { status: 500 }
    );
  }
}
