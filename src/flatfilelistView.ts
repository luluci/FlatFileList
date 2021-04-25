
import * as vscode from 'vscode';
import {posix} from 'path';

export class TreeItem extends vscode.TreeItem {
	constructor(dir: string, fileUri :vscode.Uri) {
		// 基底クラスコンストラクタ
		// resourceUriで初期化
		// labelはresourceUrから設定される
		super(fileUri, vscode.TreeItemCollapsibleState.None);
		// 拡張情報
		if (dir === "") {
			dir = "/";
		}
		this.description = dir;
		this.command = {
			title: "open file",
			command: "vscode.open",
			arguments: [fileUri]
		};
	}
}

export class FlatFileListView implements vscode.TreeDataProvider<TreeItem> {
	private filetree: TreeItem[];
	private _onDidChangeTreeData: vscode.EventEmitter<TreeItem | null> = new vscode.EventEmitter<TreeItem | null>();
	readonly onDidChangeTreeData: vscode.Event<TreeItem | null> = this._onDidChangeTreeData.event;
	private _fileSystemWatcher: Array<vscode.FileSystemWatcher>;
	
	constructor(private context: vscode.ExtensionContext) {
		// イベント登録
		vscode.workspace.onDidChangeWorkspaceFolders(e => this.onWorkspaceChanged(e));
		// workspace内のファイル追加,削除,リネームを検出する
		// VSCode外からの操作も検出するためにFileSystemWatcherを使用する
		//vscode.workspace.onDidCreateFiles(e => this.onFileCreated(e));
		//vscode.workspace.onDidDeleteFiles(e => this.onFileDeleted(e));
		//vscode.workspace.onDidRenameFiles(e => this.onFileRenamed(e));
		//
		this._fileSystemWatcher = [];
		const rootDirs = vscode.workspace.workspaceFolders;
		if (rootDirs) {
			for (let i = 0; i < rootDirs.length; i++) {
				let fileWatcher = vscode.workspace.createFileSystemWatcher(new vscode.RelativePattern(rootDirs[i], "**/*.*"));
				fileWatcher.onDidCreate(e => this.onFWCreated(e));
				fileWatcher.onDidDelete(e => this.onFWDeleted(e));
				fileWatcher.onDidChange(e => this.onFWChanged(e));
				this._fileSystemWatcher.push(fileWatcher);
			}
		}
		// Treeデータ初期化
		this.filetree = [];
		
	}

	refresh(item: TreeItem|null): void {
		this._onDidChangeTreeData.fire(item);
	}

	sort() {
		
	}

	private onFWCreated(uri: vscode.Uri) {
		console.log(":onFWCreated:");
		console.log(uri);
		// 新規ファイル
		let relPath = this.makeRelPath(uri);
		let item = new TreeItem(relPath, uri);
		// Treeに追加
		this.filetree.push(item);
		// refresh
		this.refresh(null);
	}
	private onFWDeleted(uri: vscode.Uri) {
		console.log(":onFWDeleted:");
		console.log(uri);
		// 要素削除
		this.filetree = this.filetree.filter((item) => {
			if (item.resourceUri) {
				return uri.path !== item.resourceUri.path;
			} else {
				return false;
			}
		});
		this.refresh(null);
	}
	private onFWChanged(event: vscode.Uri) {
		// ファイル内容変更時イベント
		//console.log(":onFWChanged:");
		//console.log(event);
	}

	private onWorkspaceChanged(event: vscode.WorkspaceFoldersChangeEvent): void {
		console.log(event);
	}
	private onFileCreated(event: vscode.FileCreateEvent) {
		console.log(event);
		for (let i=0; i<event.files.length; i++) {
			// 新規ファイル
			let newUri = event.files[i];
			let relPath = this.makeRelPath(newUri);
			let item = new TreeItem(relPath, newUri);
			// Treeに追加
			this.filetree.push(item);
		}
		this.refresh(null);
	}
	private onFileDeleted(event: vscode.FileDeleteEvent) {
		console.log(event);
		// 削除ファイルリスト作成
		let delUriList = Array<string>();
		for (let i = 0; i < event.files.length; i++) {
			delUriList.push(event.files[i].path);
		}
		// 要素削除
		this.filetree = this.filetree.filter((item)=>{
			if (item.resourceUri) {
				return !delUriList.includes(item.resourceUri.path);
			} else {
				return false;
			}
		});
		this.refresh(null);
	}
	private onFileRenamed(event: vscode.FileRenameEvent) {
		console.log(event);
		let tgtItem: TreeItem|undefined = undefined;
		for (let i=0; i<event.files.length; i++) {
			let oldUri = event.files[i].oldUri;
			let newUri = event.files[i].newUri;
			// TreeItem更新
			let item = this.filetree.find(item => item.resourceUri?.path === oldUri.path);
			if (item) {
				item.resourceUri = newUri;
				tgtItem = item;
			}
		}
		if (tgtItem) {
			//
			this.refresh(tgtItem);
		}
	}

	private makeRelPath(fileUri: vscode.Uri) {
		const rootDirs = vscode.workspace.workspaceFolders;
		if (rootDirs) {
			for (let i = 0; i < rootDirs.length; i++) {
				let result = posix.relative(rootDirs[i].uri.path, fileUri.path);
				let relDir = posix.dirname(result);
				if (relDir === ".") {
					return "";
				} else if (relDir !== "") {
					return "/" + relDir;
				}
			}
		}
		return "";
	}

	async generateTree() {
		const rootDirs = vscode.workspace.workspaceFolders;
		if (rootDirs !== undefined) {
			// ディレクトリリスト作成
			let dirList: Array<[vscode.Uri, string]> = [];
			for (let i = 0; i < rootDirs.length; i++) {
				dirList.push([rootDirs[i].uri, ""]);
			}
			// ディレクトリ探索
			for (let i = 0; i < dirList.length; i++) {
				const [dirUri, relPath] = dirList[i];
				for (const [name, type] of await vscode.workspace.fs.readDirectory(dirUri)) {
					if (type === vscode.FileType.File) {
						let fileUri = vscode.Uri.parse(posix.join(dirUri.path, name));
						let item = new TreeItem(relPath, fileUri);
						this.filetree.push(item);
						console.log(name);
					} else if (type === vscode.FileType.Directory) {
						// 子ディレクトリURIを作成
						let child = vscode.Uri.parse(posix.join(dirUri.path, name));
						dirList.push([child, relPath + "/" + name]);
					}
				}
			}
		}
		return this.filetree;
	}

	getTreeItem(element: TreeItem): TreeItem {
		return element;
	}

	getChildren(element?: TreeItem): Thenable<TreeItem[]> {
		if (this.filetree.length === 0) {
			return Promise.resolve(this.generateTree());
		} else {
			return Promise.resolve(this.filetree);
		}
	}
}
