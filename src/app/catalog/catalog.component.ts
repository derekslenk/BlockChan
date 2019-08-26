import { Component, OnInit } from '@angular/core';
import {Buffer} from 'buffer';
import { IndImmChanPostService } from '../ind-imm-chan-post.service';
import { map, filter, switchMap } from 'rxjs/operators';
import { IndImmChanPost } from '../ind-imm-chan-post';
import { IndImmChanPostManagerService } from '../ind-imm-chan-post-manager.service';
import { IndImmChanAddressManagerService } from '../ind-imm-chan-address-manager.service';
import { IndImmChanPostModel } from '../ind-imm-chan-post-model';
import { IndImmChanThread } from '../ind-imm-chan-thread';
import { ActivatedRoute } from '@angular/router';
import {Router} from '@angular/router';
import { ToastrService } from 'ngx-toastr';
import { ChunkingUtility } from '../chunking-utility';
import { IndImmConfigService } from '../ind-imm-config.service';
import { GlobalEventService } from '../global-event.service';
import { ConfirmDialogComponent } from '../confirm-dialog/confirm-dialog.component';
import {MatDialog, MatDialogRef, MAT_DIALOG_DATA} from '@angular/material/dialog';
import { ConfirmEncryptPostComponent } from '../confirm-encrypt-post/confirm-encrypt-post.component';
import { PostKey } from '../post-key';


@Component({
  selector: 'app-catalog',
  templateUrl: './catalog.component.html',
  styleUrls: ['./catalog.component.scss']
})
export class CatalogComponent implements OnInit {
  AddressManagerService: IndImmChanAddressManagerService;
  IndImmChanPostManagerService: IndImmChanPostManagerService;
  GlobalEventService: GlobalEventService;
  Route: ActivatedRoute
  ToastrService: ToastrService;
  Config: IndImmConfigService

  postBoardName = '';
  postTitle = '';
  postMessage = '';
  postBoard  = '';
  posterName = 'Anonymous';
  fileToUpload: File = null;
  resultImage: any = null;
  parentTx = '';
  threads: IndImmChanThread[] = null;
  Router: Router;
  PostLoading = false;
  Posting = false;
  PostingError = false;
  PostingEnabled = true;
  PostingSecondsLeftCounter = 0;
  ShowPostingForm = false;
  PostIsEncrypted = false;
  EncryptedKey:PostKey;
  Dialog: MatDialog;
  EthTipAddress = '';
  TripAddress = '';
  TripSecret = '';
  TripName = '';
  ShowTripEntry = false;

  constructor(indImmChanPostManagerService: IndImmChanPostManagerService, indImmChanAddressManagerService: IndImmChanAddressManagerService,
    route: ActivatedRoute, router:Router, toasterService: ToastrService, globalEventService: GlobalEventService, config: IndImmConfigService,
    dialog: MatDialog) {
      this.Dialog = dialog;
      this.Config = config;
      this.Route = route;
      this.IndImmChanPostManagerService = indImmChanPostManagerService;
      this.AddressManagerService = indImmChanAddressManagerService;
      this.Router = router;
      this.ToastrService = toasterService;
      this.GlobalEventService = globalEventService;
      this.GlobalEventService.ShowImagesToggled.subscribe(state=>{

        if(state) {
          this.showImagesFromToggle()
        } else {
          this.hideImagesFromToggle();
        }
      });
  
      const cu: ChunkingUtility = new ChunkingUtility();
    }

    AddTrip() {
      this.ShowTripEntry = true;
    }
    OpenPostInNewWindows(thread:IndImmChanThread) {
      const url = this.Router.createUrlTree(['BlockChan/postViewer/' + this.postBoard + '/' + thread.IndImmChanPostModelParent.Tx]);

      window.open(url.toString(), '_blank');
    }
  
    OpenPolitics() {
      this.selfInit('pol');
    }
  
    OpenBusiness() {
      this.selfInit('biz');
    }
  
    OpenRandom() {
      this.selfInit('b');
    }

  async ConfirmEncryption() {
    const dialogRef = this.Dialog.open(ConfirmEncryptPostComponent, {
      width: '650px',
      panelClass: 'custom-modalbox'
    });

    dialogRef.afterClosed().subscribe(async result => {
      if (result) {
        this.EncryptedKey = result;
        this.PostIsEncrypted = true;

        const cu:ChunkingUtility = new ChunkingUtility();

        const origValue = 'test';
        console.log('origValue: ' + origValue);

        const enc = await cu.EncryptMessage(origValue, this.EncryptedKey.Key,this.EncryptedKey.IVAsUint8);
        console.log('Enc: ' + enc);

        const dec = await await cu.DecryptMessage(enc,this.EncryptedKey.Key, this.EncryptedKey.IV);
        console.log('dec: ' + dec);

      } else {
        this.PostIsEncrypted = false;
      }
    });
  } 

  async showImagesFromToggle() {
    for (let i = 0; i < this.threads.length; i++) {
      if(!this.threads[i].IndImmChanPostModelParent.Enc) {
        this.IndImmChanPostManagerService.ManualOverRideShowImage(this.threads[i].IndImmChanPostModelParent).then(result=>{
          this.threads[i].IndImmChanPostModelParent = result;
        });
    }
    }
  }

  async hideImagesFromToggle() {
    for (let i = 0; i < this.threads.length; i++) {
      this.IndImmChanPostManagerService.ManualOverRideHideImages(this.threads[i].IndImmChanPostModelParent).then(result=>{
        this.threads[i].IndImmChanPostModelParent = result;
      });          
    }
  }

  togglePostingForm() {
    this.ShowPostingForm = !this.ShowPostingForm;
  }

  public async blockPosting() {
    this.PostingEnabled = false;
    this.PostingSecondsLeftCounter = 60;
    const cu: ChunkingUtility = new ChunkingUtility();

    for(let i = 0; i < 60; i++) {
      this.PostingSecondsLeftCounter--;
      await cu.sleep(1000);
    }
    this.PostingSecondsLeftCounter = 0;
    this.PostingEnabled = true;
  }

  async refresh(silent: boolean) {

    if(!silent) {
      this.PostLoading = true;
    }

    while (!this.IndImmChanPostManagerService.IndImmChanPostService.rippleService.Connected) {
      await this.IndImmChanPostManagerService.IndImmChanPostService.chunkingUtility.sleep(1000);
    }
    const threads = await this.IndImmChanPostManagerService.GetPostsForCatalog(this.AddressManagerService.GetBoardAddress(this.postBoard));
    for (let i = 0; i < threads.length; i++) {
      threads[i].Prep();
    }

    threads.sort(this.compare);
    this.threads = threads;
    this.PostLoading = false;
    localStorage.setItem(this.postBoard, JSON.stringify(this.threads));
  }
  
  public handleFileInput(files: FileList) {
    this.fileToUpload = files.item(0);
  }

  async post() {
    if (!this.fileToUpload) {
      this.ToastrService.error('Must include a file.', 'Posting Error');
      return;
    }
    if (this.fileToUpload.size > 4400000) {
      this.ToastrService.error('File must be below 4 Megs', 'Posting Error');
      return;
    }
    if (!(this.fileToUpload.type === 'image/jpeg' ||
      this.fileToUpload.type === 'image/gif' ||
      this.fileToUpload.type === 'image/png')) {
        this.ToastrService.error('File must be of type Jpeg, Gif, or PNG; Webm coming soon', 'Posting Error');
        return;
    }
    if (this.postMessage.length > 420) {
      this.ToastrService.error('Message must be less than 420 characters.', 'Posting Error');
      return;
    }
    if (this.postMessage.length === 0) {
      this.ToastrService.error('Message must not be empty', 'Posting Error');
      return;
    }
    if (this.postTitle.length === 0) {
      this.ToastrService.error('Title must not be empty', 'Posting Error');
      return;
    }
    if (this.postTitle.length> 80) {
      this.ToastrService.error('Title must be less than 80 characters.', 'Posting Error');
      return;
    }

    let useTrip = false;

    if(this.TripAddress.length > 0 || this.TripSecret.length > 0) {
      const tripValid = await this.IndImmChanPostManagerService.IndImmChanPostService.rippleService.IsSenderSecretValid(this.TripAddress, this.TripSecret);
      if (tripValid) {
        useTrip = true;
        this.IndImmChanPostManagerService.IndImmChanPostService.TripKey = this.TripAddress;
        this.IndImmChanPostManagerService.IndImmChanPostService.TripSecret = this.TripSecret;
        this.IndImmChanPostManagerService.IndImmChanPostService.TripValid = true;
      } else {
        this.ToastrService.error('Invalid secret/key', 'Error');
        return;
      }
    } else {
      this.IndImmChanPostManagerService.IndImmChanPostService.TripKey = '';
      this.IndImmChanPostManagerService.IndImmChanPostService.TripSecret = '';
      this.IndImmChanPostManagerService.IndImmChanPostService.TripValid = false;
    }
    
    if(!this.ShowTripEntry) {
      this.posterName = 'Anonymous';
    }
    
    this.Posting = true;

    try {
      this.blockPosting();
      const tx = await this.IndImmChanPostManagerService.post(this.postTitle, this.postMessage, this.posterName, 
        this.fileToUpload, this.postBoard, this.parentTx, this.EncryptedKey, this.EthTipAddress, useTrip);
      this.PostingError = false;
      this.Router.navigate(['/postViewer/' + this.postBoard + '/' + tx]);
      // this.refresh();
    } catch (error) {
      console.log(error);
      this.PostingError = true;
      this.PostingEnabled = true;
    }  
    this.Posting = false;
  }
  
  async OpenThread(thread: IndImmChanThread){
    localStorage.setItem('thread-' + thread.IndImmChanPostModelParent.Tx, JSON.stringify(thread));
    this.Router.navigate(['/postViewer/' + this.postBoard + '/' + thread.IndImmChanPostModelParent.Tx]);

  }
  ngOnInit() {
    this.postBoard = this.Route.snapshot.params['board'];

    if (this.postBoard === 'pol') {
      this.postBoardName = 'Politically Incorrect';
    } else if (this.postBoard === 'biz') {
      this.postBoardName = 'Business';
    } else if (this.postBoard === 'b') {
      this.postBoardName = 'Random';
    }
    
    const boardString = localStorage.getItem(this.postBoard);
    if(boardString) {
      const threadsFromCache: IndImmChanThread[] = JSON.parse(boardString);
      this.threads = threadsFromCache;
      this.refresh(true);
    }
    else {
      this.refresh(false);
    }
  }

  selfInit(board) {
    this.postBoard = board;

    if (this.postBoard === 'pol') {
      this.postBoardName = 'Politically Incorrect';
    } else if (this.postBoard === 'biz') {
      this.postBoardName = 'Business';
    } else if (this.postBoard === 'b') {
      this.postBoardName = 'Random';
    }
    this.refresh(false);
  }
  async ManualOverRideShowImage(post: IndImmChanPostModel) {
    post.ShowFullSizeFile = false;
    await this.IndImmChanPostManagerService.ManualOverRideShowImage(post);
  }


  compare( a: IndImmChanThread, b:IndImmChanThread ) {
    if ( a.LastCommentTime < b.LastCommentTime ){
      return 1;
    }
    if ( a.LastCommentTime > b.LastCommentTime ){
      return -1;
    }
    return 0;
  }
}
