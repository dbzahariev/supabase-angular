import { Component, OnInit, signal } from '@angular/core';
import { SupabaseChatService, Message } from '../supabase-chat.service';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { Slider, } from 'primeng/slider';
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';

@Component({
    selector: 'app-chat',
    standalone: true,
    templateUrl: './chat.component.html',
    styleUrls: ['./chat.component.css'],
    imports: [FormsModule, CommonModule, Slider, ToastModule],
    providers: [MessageService]
})
export class ChatComponent implements OnInit {
    messages: Message[] = [];
    users: { id: number; name: string }[] = [];
    selectedUserId: number | null = null;
    newMessage = '';
    fontSize!: number;

    constructor(private chatService: SupabaseChatService, private messageService: MessageService) { }

    ngOnInit() {
        this.chatService.messages$.subscribe(msgs => {
            const oldMessagesArr = this.messages;
            let oldMessagesStr = JSON.stringify(oldMessagesArr);
            let newMessagesStr = JSON.stringify(msgs);
            if (oldMessagesArr.length > 0 && oldMessagesStr !== newMessagesStr) {
                this.messageService.add({
                    summary: 'New Messages',
                    detail: 'You have new messages'
                });
            }
            this.messages = msgs;
        });
        this.fetchUsers();
        this.fontSize = Number(localStorage.getItem('chat-font-size') ?? 16);
    }

    updateFontSize(event: any) {
        let savedFontSize = Number(localStorage.getItem('chat-font-size') ?? 0);
        if (event && Number(event) !== savedFontSize) {
            localStorage.setItem('chat-font-size', event.toString());
        }
    }

    onUserChange(event: any) {
        localStorage.setItem('chat-selected-user-id', (event ?? "").toString());
        this.fetchUsers().then(() => { });
    }

    async fetchUsers() {
        let uniqueUsers = await this.fetchUsersWithLastBackupYear() ?? [{ id: 1, name: '' }];
        this.users = uniqueUsers;
        let savedUserId = localStorage.getItem('chat-selected-user-id');
        if (savedUserId === null) {
            localStorage.setItem('chat-selected-user-id', this.users[0].id.toString());
            savedUserId = this.users[0].id.toString();
        }
        if (this.users.length > 0) {
            let savedUserId = localStorage.getItem('chat-selected-user-id');
            this.selectedUserId = this.users.find(user => user.id === Number(savedUserId))?.id ?? this.users[0].id;
        }
    }

    async fetchUsersWithLastBackupYear() {
        let lastBackupYear = await this.getLastBackupYear();
        const { data, error } = await this.chatService['supabase']
            .from('users')
            .select('id, name, predictions!inner(backup_year)')
            .eq('predictions.backup_year', lastBackupYear);

        // Remove the predictions property from each user object
        if (data) {
            data.forEach((user: any) => {
                delete user.predictions;
            });
        }
        if (!error && data) {
            // Remove duplicate users if any
            const uniqueUsers = Array.from(new Map(data.map(u => [u.id, u])).values());
            return uniqueUsers;
        }
        return null;
    }

    async getLastBackupYear() {
        const { data, error } = await this.chatService['supabase']
            .from('predictions')
            .select('backup_year, date, user_id')
            .order('date', { ascending: false })
            .limit(1)
            .maybeSingle();
        if (!error && data) {
            return data.backup_year;
        }
        return null;
    }

    async sendMessage() {
        if (this.selectedUserId && this.newMessage.trim()) {
            await this.chatService.sendMessage(this.selectedUserId, this.newMessage.trim());
            this.newMessage = '';
        }
    }
}
