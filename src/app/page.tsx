"use client"

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { PdfViewer, PdfViewerSelection, PdfViewerPageList, PdfViewerSelectionArea, PdfViewerSelectionClear, SelectionProps, PdfViewerHighlight, PdfViewerInteractiveArea, PdfViewerHeader, PdfViewerFooter, PdfViewerZoomIn, PdfViewerZoomOut, PdfViewerZoom, PdfViewerPaginationNext, PdfViewerPaginationBack, PdfViewerNavigateToHighlightAction, PdfViewerThumbnailsList, PdfViewerThumbnailItem, PdfViewerBookmarksList, PdfViewerBookmarksListItem } from "@/components/ui/pdf-viewer";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Sheet, SheetClose, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { BookmarkIcon, ChevronLeftIcon, ChevronRightIcon, GalleryThumbnailsIcon, MessageCircleIcon, MessageSquareIcon, ZoomInIcon, ZoomOutIcon } from "lucide-react";
import { FC, useCallback, useState } from "react";

interface Note extends SelectionProps {
  text: string
}

export default function Page() {
  const [notes, setNotes] = useState<Note[]>([]);

  const [selection, setSelection] = useState<SelectionProps | undefined>(undefined);

  const handleAddNote = (note: Note) => {
    setNotes((prevState) => [...prevState, note]);
    setSelection(undefined)
  }

  return (
    <PdfViewer file="/investment-memo.pdf" mode="multiple" scrollOffset={110} >
      <PdfViewerHeader className="items-center justify-between">
        <div className="flex items-center gap-2">
          <ThumbnailsSheet />
          <OutlinesSheet />
        </div>

        <div className="flex items-center gap-2">
          <NotesSheet notes={notes} />

          <PdfViewerPaginationBack asChild>
            <Button size="icon" variant="outline">
              <ChevronLeftIcon />
            </Button>
          </PdfViewerPaginationBack>

          <PdfViewerPaginationNext asChild>
            <Button size="icon" variant="outline">
              <ChevronRightIcon />
            </Button>
          </PdfViewerPaginationNext>

          <PdfViewerZoomIn asChild>
            <Button size="icon" variant="outline">
              <ZoomInIcon />
            </Button>
          </PdfViewerZoomIn>

          <PdfViewerZoom />

          <PdfViewerZoomOut asChild>
            <Button size="icon" variant="outline">
              <ZoomOutIcon />
            </Button>
          </PdfViewerZoomOut>
        </div>
      </PdfViewerHeader>

      <PdfViewerPageList onSelectionChange={setSelection}>
        <PdfViewerSelection />
        <PdfViewerSelectionArea>
          <AddNote selection={selection} onAddNotes={handleAddNote} />
        </PdfViewerSelectionArea>

        {notes.map((item, index) => (
          <Popover key={index}>
            <PopoverTrigger asChild>
              <PdfViewerHighlight page={item.page} coords={item.coords} className="cursor-pointer" />
            </PopoverTrigger>
            <PopoverContent className="p-0 outline border-none">
              <Card>
                <CardHeader>
                  <CardTitle>Adicionar comentário</CardTitle>
                  <CardDescription>Adicionar um comentário a essa seleção</CardDescription>
                </CardHeader>

                <CardContent>
                  <Textarea readOnly value={item.text} />
                </CardContent>

                <CardFooter className="space-x-4">
                  <Button>Fechar</Button>
                  <Button>Salvar</Button>
                </CardFooter>
              </Card>
            </PopoverContent>
          </Popover>
        ))}
      </PdfViewerPageList>
      <PdfViewerFooter>
        <h1>h1</h1>
      </PdfViewerFooter>
    </PdfViewer>
  )
}

interface AddNoteProps {
  selection: SelectionProps | undefined;
  onAddNotes: (note: Note) => void
}

const AddNote: FC<AddNoteProps> = ({ selection, onAddNotes }) => {
  const [open, setIsOpen] = useState(false)
  const [text, setText] = useState<string>("");

  const handleAddNote = useCallback(() => {
    setIsOpen(false)

    if (!selection) return

    onAddNotes({
      ...selection,
      text
    })
  }, [onAddNotes, selection, text])

  return (
    <Popover open={open} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="icon">
          <MessageSquareIcon />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="p-0 outline border-none">
        <PdfViewerInteractiveArea>
          <Card>
            <CardHeader>
              <CardTitle>Adicionar comentário</CardTitle>
              <CardDescription>Adicionar um comentário a essa seleção</CardDescription>
            </CardHeader>

            <CardContent>
              <Textarea value={text} onChange={e => setText(e.target.value)} />
            </CardContent>

            <CardFooter className="space-x-4">
              <Button>Fechar</Button>
              <PdfViewerSelectionClear asChild>
                <Button onClick={handleAddNote}>Salvar</Button>
              </PdfViewerSelectionClear>
            </CardFooter>
          </Card>
        </PdfViewerInteractiveArea>
      </PopoverContent>
    </Popover>
  )
}

interface NotesSheetProps {
  notes: Note[]
}

const NotesSheet: FC<NotesSheetProps> = ({ notes }) => {
  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button size="icon" variant="outline">
          <MessageCircleIcon />
        </Button>
      </SheetTrigger>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Notas</SheetTitle>
          <SheetDescription>Notas do documento</SheetDescription>
        </SheetHeader>

        <div className="px-4 space-y-4">
          {notes.map((item, index) => (
            <Card key={index}>
              <CardHeader>
                <CardTitle>
                  Nota
                </CardTitle>
                <CardDescription>
                  {item.content}
                </CardDescription>
              </CardHeader>

              <CardFooter>
                <PdfViewerNavigateToHighlightAction asChild page={item.page} coords={item.coords}>
                  <SheetClose asChild>
                    <Button>Navegar</Button>
                  </SheetClose>
                </PdfViewerNavigateToHighlightAction>
              </CardFooter>
            </Card>
          ))}
        </div>
      </SheetContent>
    </Sheet>
  )
}

const ThumbnailsSheet = () => {
  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button size="icon" variant="outline">
          <GalleryThumbnailsIcon />
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-[280px] flex flex-col">
        <SheetHeader>
          <SheetTitle>Thumbnails</SheetTitle>
          <SheetDescription>Thumbnails do documento</SheetDescription>
        </SheetHeader>

        <PdfViewerThumbnailsList
          className="overflow-auto pb-8"
          render={(pageNumber) => (
            <SheetClose asChild>
              <PdfViewerThumbnailItem pageNumber={pageNumber} />
            </SheetClose>
          )}
        />
      </SheetContent>
    </Sheet>
  )
}

const OutlinesSheet = () => {
  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button size="icon" variant="outline">
          <BookmarkIcon />
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="flex flex-col">
        <SheetHeader>
          <SheetTitle>Thumbnails</SheetTitle>
          <SheetDescription>Thumbnails do documento</SheetDescription>
        </SheetHeader>

        <PdfViewerBookmarksList
          className="overflow-auto pb-8 space-y-2 px-4 flex flex-col items-start"
          render={(bookmark) => (
            <SheetClose asChild>
              <PdfViewerBookmarksListItem bookmark={bookmark} asChild>
                <Button variant="link">
                  <BookmarkIcon />
                  {bookmark.title}
                </Button>
              </PdfViewerBookmarksListItem>
            </SheetClose>
          )}
        />
      </SheetContent>
    </Sheet>
  )
}