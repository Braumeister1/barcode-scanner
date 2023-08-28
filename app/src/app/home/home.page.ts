import { Component, OnInit } from '@angular/core';
import { Barcode, BarcodeScanner } from '@capacitor-mlkit/barcode-scanning';
import { AlertController } from '@ionic/angular';
import { Preferences } from '@capacitor/preferences';
import { Browser } from '@capacitor/browser';
import { Clipboard } from '@capacitor/clipboard';
import { FilePicker } from '@capawesome/capacitor-file-picker';
import { Share } from '@capacitor/share';

@Component({
  selector: 'app-home',
  templateUrl: 'home.page.html',
  styleUrls: ['home.page.scss'],
})
export class HomePage implements OnInit {
  isSupported = false;
  barcodes: Barcode[] = [];

  constructor(private alertController: AlertController) { }

  ngOnInit() {
    BarcodeScanner.isSupported().then((result) => {
      this.isSupported = result.supported;
    });

    this.load().then((loadedBarcodes) => {
      if (loadedBarcodes !== null) {
        this.barcodes = loadedBarcodes;
      }
    });
  }

// runs by scanning
  async scan(): Promise<void> {
    const granted = await this.requestPermissions();
    if (!granted) {
      this.presentAlert();
      return;
    }

    await BarcodeScanner.isGoogleBarcodeScannerModuleAvailable().then(async (data) => {
      if (data.available) {
        console.log("No installation needed.");
        const { barcodes } = await BarcodeScanner.scan();
        this.barcodes.push(...barcodes);
        this.save();
      }
      else {
        console.log("Listening for module installation progress...");
        await new Promise<void>((resolve) => {
          BarcodeScanner.addListener('googleBarcodeScannerModuleInstallProgress', async (event) => {
            console.log("Module installation progress event received:", event);
            if (event.state === 4) {
              this.presentAlertInstallationMLKit();
              resolve();
            }
          });
          BarcodeScanner.installGoogleBarcodeScannerModule();
        });
      }
    });
  }

// runs by scan from image
  async scanfromimage(){
    const result = await FilePicker.pickImages({
      multiple: false,
    });
    const file = result.files[0];
    console.log("Trying to extract barcode form picture.", file);
    if (!file.path) {
      return;
    }
    const { barcodes } = await BarcodeScanner.readBarcodesFromImage({path: file.path});
        this.barcodes.push(...barcodes);
        this.save();
        if (barcodes.length > 0){
          console.log("Extraction successful.", barcodes)
        }
        else{
          console.log("Extraction failed.", barcodes)
          this.presentAlertPictureExtraction();
        }
        
  }
// saves the barcodes on the device
  async save(): Promise<void> {
    await Preferences.set({
      key: 'barcodes',
      value: JSON.stringify(this.barcodes),
    });
  }

// loads the barcodes from the device
  async load(): Promise<Barcode[] | null> {
    const item = await Preferences.get({ key: 'barcodes' });
    if (typeof item.value === 'string') {
      return JSON.parse(item.value);
    } else {
      return null;
    }
  }

// handles camera permissions
  async requestPermissions(): Promise<boolean> {
    const { camera } = await BarcodeScanner.requestPermissions();
    return camera === 'granted' || camera === 'limited';
  }

// alert for camera
  async presentAlert(): Promise<void> {
    const alert = await this.alertController.create({
      header: 'Permission denied',
      message: 'Please grant camera permission to use the barcode scanner.',
      buttons: ['OK'],
    });
    await alert.present();
  }
// alert for installation Google ML Kit
  async presentAlertInstallationMLKit(): Promise<void> {
    const alert = await this.alertController.create({
      header: 'Installation successful',
      message: 'The Google ML Kit installation was successful. The scanning should work now.',
      buttons: ['OK'],
    });
    await alert.present();
  }

// alert for opening is not supported
  async presentAlertOpenNotSupported(): Promise<void> {
    const alert = await this.alertController.create({
      header: 'Opening is not supported',
      message: 'The selected barcode can not be opened. Maybe this Feature will be implemented in a later version of the app.',
      buttons: ['OK'],
    });
    await alert.present();
  }

// alert for sharing is not supported
  async presentAlertShareNotSupported(): Promise<void> {
    const alert = await this.alertController.create({
      header: 'Sharing is not supported',
      message: 'The selected barcode can not be shared. Maybe this feature will be implemented in a later version of the app.',
      buttons: ['OK'],
    });
    await alert.present();
  }

// alert for failed picture extraction
  async presentAlertPictureExtraction(): Promise<void> {
    const alert = await this.alertController.create({
      header: 'Barcode extraction failed',
      message: 'The selected picture is not capable for a barcode extraction. Try another picture.',
      buttons: ['OK'],
    });
    await alert.present();
  }

// deletes the barcodes on the device
  deleteBarcode(index: number): void {
    this.barcodes.splice(index, 1);
    this.save();
  }

// opens the barcodes
  openBarcode(index: number): void {
    console.log('Opening barcode at index:', index);
  
    const barcode = this.barcodes[index];
    if (barcode.format === 'QR_CODE' && barcode.valueType === 'URL') 
    {
      console.log('URL barcode detected. Opening URL:', barcode.displayValue);
      Browser.open({ url: barcode.displayValue });
    } 
    else if (barcode.format === 'QR_CODE' && barcode.valueType === 'CONTACT_INFO') 
    {
      const phoneNumber = this.extractPhoneNumber(barcode.rawValue);
      if (phoneNumber) 
      {
        console.log('Contact information barcode detected. Phone number:', phoneNumber);
        window.open(`tel:${phoneNumber}`, "_system");
      } 
      else 
      {
        console.log('Contact information barcode does not contain phone numbers.');
        this.presentAlertOpenNotSupported();
      }
    } 
    else if (barcode.format === 'QR_CODE' && barcode.valueType === 'PHONE') 
    {
      const phoneNumber = barcode.displayValue;
      console.log('Contact information barcode detected. Phone number:', phoneNumber);
      window.open(`tel:${phoneNumber}`, "_system");
    } 
    else 
    {
      console.log('Unsupported barcode type detected.');
      this.presentAlertOpenNotSupported();
    }
  }


// extracts the phone number of rawValue
    extractPhoneNumber(rawValue: string): string | null {
      const phoneNumberRegex = /TEL.*?(\d+)/;
      const match = rawValue.match(phoneNumberRegex);
      console.log(match);
      if (match && match[1]) {
        return match[1];
      } 
      else 
      {
        return null;
      }
    }
  
// saves the barcode information to clipboard
  async copyBarcode(index: number): Promise <void> {
      await Clipboard.write({
        string: this.barcodes[index].displayValue
      });
      console.log("Saved in Zwischenablage", this.barcodes[index].displayValue);
    }

// shares the barcodes
  async shareBarcode(index: number): Promise <void> {
    const barcode = this.barcodes[index];
    console.log("Trying to share:", barcode.displayValue, index);
    if (barcode.format === 'QR_CODE' && barcode.valueType === 'URL')
    {
      await Share.share({
      title: 'Shared URL',
      text: 'Check this out!',
      url: barcode.displayValue,
      dialogTitle: 'Share with people',
    });
    }
    else if (barcode.format === 'QR_CODE' && barcode.valueType === 'CONTACT_INFO') 
    {
      const phoneNumber = this.extractPhoneNumber(barcode.rawValue);
      if (phoneNumber) 
      {
        await Share.share({
          title: 'Shared phone number',
          text: phoneNumber,
          dialogTitle: 'Share with people',
        });
      } 
      else 
      {
        console.log('Contact information barcode does not contain phone numbers.');
        this.presentAlertShareNotSupported();
      }
    }
    else if (barcode.format === 'QR_CODE' && barcode.valueType === 'PHONE') 
    {
      const phoneNumber = barcode.displayValue;
      await Share.share({
        title: 'Shared phone number',
        text: phoneNumber,
        dialogTitle: 'Share with people',
      });
    }
    else 
    {
      this.presentAlertShareNotSupported();
    }
  }

  }


