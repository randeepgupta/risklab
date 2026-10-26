import {useEffect,useState} from 'react';
import type {PortfolioLibrary,SavedPortfolio} from '../types/workspace';
import {emptyLibrary,mergePortfolioLibraries,PORTFOLIO_STORAGE_KEY,readPortfolioLibrary,writePortfolioLibrary} from '../utils/savedPortfolios';

function readBrowserLibrary() {
  if(typeof window==='undefined') return {library:emptyLibrary(),error:'',blocked:false};
  try {return {library:readPortfolioLibrary(window.localStorage),error:'',blocked:false};}
  catch(error) {return {library:emptyLibrary(),error:error instanceof Error?error.message:'Saved portfolios cannot be read on this device.',blocked:true};}
}
export function usePortfolioLibrary() {
  const [state,setState]=useState(readBrowserLibrary);
  const [message,setMessage]=useState('');
  useEffect(()=>{
    const reload=(event:StorageEvent)=>{
      if(event.key===PORTFOLIO_STORAGE_KEY || event.key===null) {setState(readBrowserLibrary());setMessage('Saved portfolios changed in another tab. Your open analysis has been kept.');}
    };
    window.addEventListener('storage',reload);
    return ()=>window.removeEventListener('storage',reload);
  },[]);
  const commit=(change:(library:PortfolioLibrary)=>PortfolioLibrary):PortfolioLibrary|null=>{
    try {
      const library=writePortfolioLibrary(window.localStorage,change(readPortfolioLibrary(window.localStorage)));
      setState({library,error:'',blocked:false});return library;
    } catch(error) {
      setState(previous=>({...previous,error:error instanceof Error?error.message:'Browser storage is unavailable. Download a backup and retry.'}));
      setMessage('The saved library was not changed.');return null;
    }
  };
  return {...state,message,setMessage,
    retry:()=>setState(readBrowserLibrary()),
    save:(portfolio:SavedPortfolio,expectedUpdatedAt?:string)=>{
      const library=commit(current=>{
        const existing=current.portfolios.find(p=>p.id===portfolio.id);
        if(expectedUpdatedAt && (!existing||existing.updatedAt!==expectedUpdatedAt)) throw new Error('This saved portfolio changed in another tab. Resume it again or save a copy.');
        return {...current,portfolios:[...current.portfolios.filter(p=>p.id!==portfolio.id),portfolio]};
      });
      if(library) setMessage(`Saved “${portfolio.name}” on this device.`);
      return !!library;
    },
    remove:(id:string)=>{
      const library=commit(current=>({...current,portfolios:current.portfolios.filter(p=>p.id!==id)}));
      if(library) setMessage('Deleted the saved portfolio from this device.');return !!library;
    },
    restore:(incoming:PortfolioLibrary)=>{
      const library=commit(current=>mergePortfolioLibraries(current,incoming,()=>crypto.randomUUID()));
      if(library) setMessage(`Added ${incoming.portfolios.length} saved portfolio${incoming.portfolios.length===1?'':'s'} from the backup.`);
      return !!library;
    },
    clearUnreadable:()=>{
      try {
        let recovered:PortfolioLibrary|undefined;
        try {recovered=readPortfolioLibrary(window.localStorage);} catch { /* Preserve until the explicit clear below. */ }
        if(recovered) {setState({library:recovered,error:'',blocked:false});setMessage('The stored library is readable again and was kept.');return;}
        window.localStorage.removeItem(PORTFOLIO_STORAGE_KEY);setState({library:emptyLibrary(),error:'',blocked:false});setMessage('Cleared RiskLab saved data from this device.');
      }
      catch {setMessage('Browser storage could not be cleared.');}
    },
  };
}
