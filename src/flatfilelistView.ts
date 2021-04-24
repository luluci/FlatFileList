import * as vscode from 'vscode';
import {posix} from 'path';

export class TreeItem extends vscode.TreeItem {
	constructor(dir: string, file_uri :vscode.Uri) {
		// 基底クラスコンストラクタ
		super(file_uri, vscode.TreeItemCollapsibleState.None);
		// 拡張情報
		this.description = dir;
		this.command = {
			title: "open file",
			command: "vscode.open",
			arguments: [file_uri]
		};
	}
}

export class flatfilelistView implements vscode.TreeDataProvider<TreeItem> {
	private filetree: TreeItem[];

	constructor(private context: vscode.ExtensionContext) {
		const root_dirs = vscode.workspace.workspaceFolders;
		this.filetree = [];
	}

	async generateTree() {
		const root_dirs = vscode.workspace.workspaceFolders;
		if (root_dirs !== undefined) {
			// ディレクトリリスト作成
			let dir_list: Array<[vscode.Uri, string]> = [];
			for (let i = 0; i < root_dirs.length; i++) {
				dir_list.push([root_dirs[i].uri, ""])
			}
			// ディレクトリ探索
			for (let i = 0; i < dir_list.length; i++) {
				const [dir_uri, rel_path] = dir_list[i];
				for (const [name, type] of await vscode.workspace.fs.readDirectory(dir_uri)) {
					if (type === vscode.FileType.File) {
						let file_uri = vscode.Uri.parse(posix.join(dir_uri.path, name));
						let item = new TreeItem(rel_path, file_uri);
						this.filetree.push(item);
						console.log(name);
					} else if (type === vscode.FileType.Directory) {
						// 子ディレクトリURIを作成
						let child = vscode.Uri.parse(posix.join(dir_uri.path, name));
						dir_list.push([child, rel_path + "/" + name]);
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
		if (element === undefined) {
			return Promise.resolve(this.generateTree());
		} else {
			return Promise.resolve(this.filetree);
		}
	}
}
